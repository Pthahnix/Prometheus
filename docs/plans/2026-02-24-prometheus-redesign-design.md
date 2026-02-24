# Prometheus Redesign — Academic Research Toolkit

Date: 2026-02-24

## Overview

Refactor Prometheus from flat `src/utils_*.ts` into a three-layer architecture: utils (atomic API wrappers), tools (pipeline orchestration), and MCP server (pure registration). Add Semantic Scholar and Unpaywall as new data sources. Implement DFS reference exploration. Remove evaluate_papers (rating delegated to Claude Code via skill prompt + abstract). Remove apify MCP server dependency in favor of direct REST API calls.

## File Structure

```
src/
  types.ts
  utils/
    arxiv.ts
    apify.ts
    markdown.ts
    misc.ts
    pdf.ts
    ss.ts
    unpaywall.ts
  tools/
    markdown.ts
    academic.ts
  mcp_server.ts
```

## Cache Structure

`DIR_CACHE` from `.env` (default `.cache/`):

```
DIR_CACHE/
  markdown/    # Full-text markdown, filename = normalizedTitle.md
  paper/       # Metadata JSON, filename = normalizedTitle.json
```

## Shared Types — `src/types.ts`

```typescript
interface PaperResult {
  title: string;
  normalizedTitle: string;
  arxivId?: string;
  doi?: string;
  s2Id?: string;
  year?: number;
  authors?: string;
  abstract?: string;
  citationCount?: number;
  arxivUrl?: string;
  pdfUrl?: string;
  sourceUrl?: string;
  markdownDir?: string;
}
```

## Utils Layer

Each file wraps one external service. All return `PaperResult` or `PaperResult[]` where applicable.

### `utils/arxiv.ts`

- `content(url: string): Promise<string | null>` — Fetch full markdown via arxiv2md.org API. Input: arXiv URL (abs or pdf). Returns markdown string or null.
- `query(title: string): Promise<PaperResult | null>` — Search arXiv API by title. Returns best match as PaperResult with arxivId, arxivUrl, title, authors, year, abstract. Returns null if no match.

### `utils/apify.ts`

- `googleScholarSearch(query: string, maxItems?: number): Promise<PaperResult[]>` — Call Apify `marco.gullo/google-scholar-scraper` via REST API (`POST /v2/acts/{actorId}/run-sync-get-dataset-items`). Auth via `TOKEN_APIFY` env var. Maps results to PaperResult[]. Extracts arxivId from URL when available.

### `utils/ss.ts`

- `query(title: string): Promise<PaperResult | null>` — Call Semantic Scholar `GET /paper/search/match?query={title}` with fields: `title,year,authors,abstract,citationCount,externalIds,openAccessPdf,url`. Maps to PaperResult. Returns null if no match or matchScore too low.
- `references(s2Id: string): Promise<PaperResult[]>` — Call `GET /paper/{s2Id}/references` with same fields. Maps each cited paper to PaperResult. Rate limit: 100 req/5min (no API key).

### `utils/unpaywall.ts`

- `query(doi: string): Promise<PaperResult | null>` — Call `GET https://api.unpaywall.org/v2/{doi}?email={EMAIL_UNPAYWALL}`. Extract `best_oa_location.url_for_pdf` as pdfUrl. Maps to PaperResult. Returns null if no OA PDF found.

### `utils/pdf.ts`

- `content(source: string): Promise<string | null>` — Convert PDF to markdown via MinerU cloud API. Input: URL or local file path. Reuses existing MinerU logic (batch upload → presigned URL → poll → ZIP → extract). Returns markdown string or null.

### `utils/markdown.ts`

- `save(title: string, markdown: string): Promise<string>` — Save markdown to `DIR_CACHE/markdown/{normalizedTitle}.md`. Returns the file path.

### `utils/misc.ts`

- `normTitle(title: string): string` — Normalize title: lowercase, non-alphanumeric → `_`, collapse multiple `_`, trim trailing `_`. Used for filenames and dedup.

## Tools Layer

Tools orchestrate utils into pipelines. Each tool function receives structured input and returns `PaperResult` or `PaperResult[]`.

### `tools/markdown.ts` — `paper2markdown`

Input: `{ title?: string, url?: string, dir?: string }`

Smart routing based on input type:

1. **arXiv URL detected** → `arxiv.content(url)` → save to cache → return PaperResult
2. **PDF URL or local path** → `pdf.content(source)` → save to cache → return PaperResult
3. **Title provided** → title2markdown pipeline:
   - `arxiv.query(title)` → if found with arxivUrl → `arxiv.content(arxivUrl)`
   - else `ss.query(title)` → if has arxivId → `arxiv.content(arxivUrl)`
   - else if has doi → `unpaywall.query(doi)` → if has pdfUrl → `pdf.content(pdfUrl)`
   - else if ss result has pdfUrl → `pdf.content(pdfUrl)`
   - Save markdown to cache, save metadata JSON to cache
   - Return PaperResult with markdownDir

### `tools/academic.ts` — `acd_search`

Input: `{ query: string }`

Pipeline:
1. `apify.googleScholarSearch(query)` → `PaperResult[]`
2. For each result:
   - If has arxivUrl → `arxiv.content(arxivUrl)`
   - Else → title2markdown pipeline (same as paper2markdown title path)
3. Save all markdown + metadata to cache
4. Return `PaperResult[]` (all with markdownDir where content was obtained)

### `tools/academic.ts` — `dfs_search`

Input: `{ paper: PaperResult, depth: number, breadth: number, visited?: Set<string> }`

Pipeline:
1. If depth <= 0, return []
2. Need s2Id — if paper lacks it, `ss.query(paper.title)` to obtain
3. `ss.references(s2Id)` → `PaperResult[]`
4. Filter: skip if normalizedTitle in visited set
5. Truncate to breadth limit
6. For each reference: run paper2markdown pipeline → save to cache
7. Add to visited set
8. For each reference: recurse `dfs_search(ref, depth-1, breadth, visited)`
9. Return flat `PaperResult[]` of all discovered papers

Global visited set uses `misc.normTitle(title)` for dedup.

## MCP Server — `src/mcp_server.ts`

Pure registration, no tool logic. Three tools:

| Tool | Description | Input Schema |
|------|-------------|-------------|
| `paper2markdown` | Convert a paper to markdown | `{ title?, url?, dir? }` |
| `acd_search` | Academic search by query | `{ query }` |
| `dfs_search` | Deep reference exploration | `{ paper: PaperResult, depth, breadth }` |

Progress notifications sent for long-running operations (PDF processing, batch search).

## Cleanup

Remove:
- `src/utils_paper.ts` (evaluate_papers logic)
- `src/utils_arxiv.ts` (replaced by `src/utils/arxiv.ts`)
- `src/utils_pdf.ts` (replaced by `src/utils/pdf.ts`)
- `src/utils_markdown.ts` (replaced by `src/utils/markdown.ts`)
- `src/service_pdf_ocr.py` (unused Modal service)
- `progress_test` tool from mcp_server
- `evaluate_papers` tool from mcp_server
- apify server from `.mcp.json`

## Environment Variables

Existing:
- `MARKDOWN_DIR` → renamed/replaced by `DIR_CACHE`
- `TOKEN_MINERU` — MinerU API token
- `TOKEN_APIFY` — Apify API token (was used by MCP, now used by utils/apify.ts)

New:
- `DIR_CACHE` — cache root directory (default `.cache/`)
- `EMAIL_UNPAYWALL` — email for Unpaywall API identification

Removed:
- `API_KEY_CHAT`, `BASE_URL_CHAT`, `MODEL_CHAT` — no longer needed (evaluate_papers removed)

## External APIs

| API | Auth | Rate Limit | Used By |
|-----|------|-----------|---------|
| arxiv2md.org | None | Unknown | utils/arxiv.ts |
| arXiv API | None | 3s delay between requests | utils/arxiv.ts |
| Apify REST | TOKEN_APIFY (query param) | Per plan | utils/apify.ts |
| Semantic Scholar | None (free tier) | 100 req/5min | utils/ss.ts |
| Unpaywall | EMAIL_UNPAYWALL (query param) | 100K/day | utils/unpaywall.ts |
| MinerU | TOKEN_MINERU | Per plan | utils/pdf.ts |
