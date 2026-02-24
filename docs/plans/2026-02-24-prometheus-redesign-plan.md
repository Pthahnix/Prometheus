# Implementation Plan — Prometheus Redesign

Design doc: `docs/plans/2026-02-24-prometheus-redesign-design.md`

## Phase 1: Foundation (no external deps)

### Step 1: Create `src/types.ts`
- Define `PaperResult` interface
- Export it for use by all utils and tools

### Step 2: Create `src/utils/misc.ts`
- `normTitle(title: string): string` — lowercase, non-alphanum → `_`, collapse, trim
- Port logic from existing `markdownFilename` in `utils_markdown.ts` (strip `.pdf`, same sanitization, but without `.md` extension)

### Step 3: Create `src/utils/markdown.ts`
- `save(title: string, markdown: string): Promise<string>` — uses `normTitle` for filename, saves to `DIR_CACHE/markdown/{normalizedTitle}.md`
- `savePaperMeta(paper: PaperResult): Promise<string>` — saves metadata JSON to `DIR_CACHE/paper/{normalizedTitle}.json`
- `loadPaperMeta(normalizedTitle: string): PaperResult | null` — load from cache if exists
- Read `DIR_CACHE` from env (default `.cache/`), ensure dirs exist

### Step 4: Update `.env`
- Add `DIR_CACHE=.cache/`
- Add `EMAIL_UNPAYWALL` placeholder
- Keep `TOKEN_MINERU`, `TOKEN_APIFY`
- Keep `MARKDOWN_DIR` for now (remove after migration verified)

## Phase 2: Utils — External API Wrappers

### Step 5: Create `src/utils/arxiv.ts`
- `content(url: string): Promise<string | null>` — port from `arxivMarkdown` in `utils_arxiv.ts`, simplified: takes URL only, calls arxiv2md.org, returns markdown string
- `query(title: string): Promise<PaperResult | null>` — port from `title_2_url`/`title_2_title` logic, search arXiv API by title, parse XML, return PaperResult with arxivId, arxivUrl, title, authors, year, abstract
- Keep helper functions: `url_2_id`, `id_2_url` as internal
- Dependencies: `fast-xml-parser`, `node-fetch`

### Step 6: Create `src/utils/ss.ts`
- `query(title: string): Promise<PaperResult | null>` — GET `/paper/search/match?query={title}&fields=title,year,authors,abstract,citationCount,externalIds,openAccessPdf,url`
- Map response to PaperResult: extract arxivId/doi from externalIds, construct arxivUrl if arxivId present
- `references(s2Id: string): Promise<PaperResult[]>` — GET `/paper/{s2Id}/references?fields=...`, map each citedPaper to PaperResult
- No auth needed, respect 100 req/5min rate limit
- Dependencies: `node-fetch`

### Step 7: Create `src/utils/unpaywall.ts`
- `query(doi: string): Promise<PaperResult | null>` — GET `https://api.unpaywall.org/v2/{doi}?email={EMAIL_UNPAYWALL}`
- Extract `best_oa_location.url_for_pdf` as pdfUrl
- Map to PaperResult with title, year, authors, doi, pdfUrl
- Return null if no OA PDF or 404
- Dependencies: `node-fetch`

### Step 8: Create `src/utils/pdf.ts`
- `content(source: string): Promise<string | null>` — port from `pdf2Markdown` in `utils_pdf.ts`
- Accept URL or local file path
- If URL: download to temp file first, then process
- Reuse MinerU logic: batch upload → presigned URL → poll → ZIP → extract
- Keep `ProgressCallback` type, accept optional `onProgress`
- Dependencies: `adm-zip`, `node-fetch`

### Step 9: Create `src/utils/apify.ts`
- `googleScholarSearch(query: string, maxItems?: number): Promise<PaperResult[]>`
- POST `https://api.apify.com/v2/acts/marco.gullo~google-scholar-scraper/run-sync-get-dataset-items?token={TOKEN_APIFY}`
- Input body: `{ keyword: query, maxItems: maxItems ?? 10, proxyOptions: { useApifyProxy: true } }`
- Map each result to PaperResult: title, year (parse from string), authors, citationCount (from citedBy), sourceUrl (from link), pdfUrl, extract arxivId from URL if present
- Dependencies: `node-fetch`

## Phase 3: Tools — Pipeline Orchestration

### Step 10: Create `src/tools/markdown.ts` — `paper2markdown`
- Export `paper2markdown({ title?, url?, dir? }): Promise<PaperResult>`
- Input detection:
  - URL contains `arxiv.org` → arXiv path
  - URL ends with `.pdf` or is local path → PDF path
  - Otherwise → title path
- arXiv path: `arxiv.content(url)` → `markdown.save()` → build PaperResult
- PDF path: `pdf.content(source)` → `markdown.save()` → build PaperResult
- Title path (title2markdown pipeline):
  1. `arxiv.query(title)` → if found → `arxiv.content(arxivUrl)`
  2. else `ss.query(title)` → if has arxivId → construct arxivUrl → `arxiv.content()`
  3. else if has doi → `unpaywall.query(doi)` → if has pdfUrl → `pdf.content(pdfUrl)`
  4. else if ss result has openAccessPdf → `pdf.content(pdfUrl)`
  5. If markdown obtained: `markdown.save()`, `markdown.savePaperMeta()`
- Return PaperResult with markdownDir populated (or null if all sources failed)

### Step 11: Create `src/tools/academic.ts` — `acdSearch` + `dfsSearch`

**`acdSearch(query: string): Promise<PaperResult[]>`**
- `apify.googleScholarSearch(query)` → PaperResult[]
- For each result (concurrent, batch of 3):
  - If has arxivUrl → `arxiv.content(arxivUrl)` → save
  - Else → title2markdown pipeline (reuse logic from paper2markdown)
- Save all metadata to cache
- Return PaperResult[] with markdownDir where available

**`dfsSearch(paper: PaperResult, depth: number, breadth: number, visited?: string[]): Promise<PaperResult[]>`**
- If depth <= 0, return []
- If paper lacks s2Id → `ss.query(paper.title)` to obtain
- If still no s2Id → return [] (can't get references)
- `ss.references(s2Id)` → PaperResult[]
- Filter out visited (by normalizedTitle)
- Truncate to breadth
- For each ref: run paper2markdown pipeline → save to cache → add to visited
- Recurse: for each ref, `dfsSearch(ref, depth-1, breadth, visited)`
- Return flat array of all discovered papers
- Note: visited is string[] over MCP (serializable), converted to Set internally

## Phase 4: MCP Server Rewrite

### Step 12: Rewrite `src/mcp_server.ts`
- Pure registration, no tool logic
- Import `paper2markdown` from `./tools/markdown.js`
- Import `acdSearch`, `dfsSearch` from `./tools/academic.js`
- Register 3 tools:
  - `paper2markdown`: `{ title?: string, url?: string, dir?: string }`
  - `acd_search`: `{ query: string }`
  - `dfs_search`: `{ title, normalizedTitle, s2Id?, depth, breadth, visited? }`
- Each tool handler: try/catch, call tool function, return JSON result
- Progress notifications for long operations

## Phase 5: Cleanup

### Step 13: Delete old files
- `src/utils_paper.ts`
- `src/utils_arxiv.ts`
- `src/utils_pdf.ts`
- `src/utils_markdown.ts`
- `src/service_pdf_ocr.py`

### Step 14: Update `.mcp.json`
- Remove `apify` server entry
- Keep only `prometheus` server

### Step 15: Update `CLAUDE.md`
- Reflect new file structure (`src/utils/`, `src/tools/`)
- Update tool table (3 tools: paper2markdown, acd_search, dfs_search)
- Update env vars section
- Remove references to evaluate_papers, progress_test

### Step 16: Update `package.json`
- Remove `alastor` dependency (no longer needed)
- Keep all other deps

## Phase 6: Testing

### Step 17: Unit tests for utils
- `.test/test-misc.ts` — normTitle edge cases
- `.test/test-arxiv.ts` — query + content with known paper
- `.test/test-ss.ts` — query + references with known paper
- `.test/test-unpaywall.ts` — query with known DOI
- `.test/test-apify.ts` — googleScholarSearch with simple query
- `.test/test-pdf.ts` — content with known PDF URL
- `.test/test-markdown.ts` — save + savePaperMeta + load

### Step 18: Integration tests for tools
- `.test/test-paper2markdown.ts` — test all 3 input paths (arXiv URL, PDF, title)
- `.test/test-acd-search.ts` — test with a real query
- `.test/test-dfs-search.ts` — test with a known paper, depth=1, breadth=3

### Step 19: Full MCP integration test
- Restart MCP server
- Test via MCP: topic "如何自研一个多模态大模型"
- Use all 3 tools: acd_search, paper2markdown, dfs_search
- Verify cache populated correctly
- Verify PaperResult metadata complete

## Dependency Graph

```
Step 1 (types) ← Step 2 (misc) ← Step 3 (markdown)
Step 1 ← Step 5 (arxiv)
Step 1 ← Step 6 (ss)
Step 1 ← Step 7 (unpaywall)
Step 1 ← Step 8 (pdf)
Step 1 ← Step 9 (apify)
Steps 2-9 ← Step 10 (tools/markdown)
Steps 2-9 ← Step 11 (tools/academic)
Steps 10-11 ← Step 12 (mcp_server)
Step 12 ← Steps 13-16 (cleanup, all independent)
Steps 2-9 ← Step 17 (unit tests)
Steps 10-11 ← Step 18 (integration tests)
Step 12 ← Step 19 (full MCP test)
```

## Parallel Execution Opportunities

- Steps 5, 6, 7, 8, 9 are independent (all depend only on Step 1)
- Steps 13, 14, 15, 16 are independent
- Steps 17, 18 can partially overlap with Phase 4
