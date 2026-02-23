# Prometheus Tools & Strategies Redesign

Date: 2026-02-23

## Overview

Restructure Prometheus from flat `src/utils_*.ts` to a two-layer architecture:
- **Utils layer** (`src/utils/`): atomic functions, one file per external service
- **Tools layer** (`src/tools/`): MCP tools that orchestrate utils into pipelines
- **Skills layer** (`skill/`): SOP strategies for Claude Code to follow

## Naming Conventions

- `search` — broad discovery (returns lists)
- `query` — specific key→value lookup
- `content` — convert item to markdown

## Paper Type

```typescript
interface Paper {
  title: string
  normalizedTitle: string  // dedup key + filename

  // External IDs (progressively filled)
  doi?: string
  arxivId?: string        // e.g. "2301.12345"
  s2Id?: string           // Semantic Scholar paperId

  // Metadata
  year?: number
  authors?: string[]
  abstract?: string
  citationCount?: number

  // Access paths (routing decision basis)
  arxivUrl?: string       // present → arxiv.content route
  pdfUrl?: string         // present → pdf.content route
  sourceUrl?: string      // original search result link

  // Origin
  source?: string         // "google_scholar" | "semantic_scholar" | "arxiv"
}
```

Progressive fill: Google Scholar gives title/sourceUrl/year → arxiv.query may add arxivUrl → ss.query adds doi/s2Id/pdfUrl.
Routing by field presence: arxivUrl → arxiv pipeline, pdfUrl → pdf pipeline, neither → skip.

## Utils Layer

```
src/utils/
  types.ts              — Paper interface, shared types
  arxiv.ts              — arxiv.content(url), arxiv.query(title)
  semantic_scholar.ts   — ss.query(title), ss.references(id), ss.citations(id)
  unpaywall.ts          — unpaywall.query(doi)
  pdf.ts                — pdf.content(url)
  apify.ts              — apify.googleScholarSearch(keyword, opts?)
  brave.ts              — brave.search(query, opts?)
  web.ts                — web.content(url)
  markdown.ts           — markdown.save(title, content)
  misc.ts               — misc.processTitle(title), misc.deduplicateByTitle(papers)
```

### arxiv.ts

```typescript
// Input: arXiv URL → Output: markdown full text, null on failure
arxiv.content(url: string): Promise<string | null>

// Input: paper title → Output: arXiv URL if found, null if not on arXiv (normal case)
arxiv.query(title: string): Promise<string | null>
```

Backend: arxiv2md.org API (existing).

### semantic_scholar.ts

```typescript
// Input: title → Output: Paper with s2Id/doi/arxivId/pdfUrl filled, null if not found
ss.query(title: string): Promise<Paper | null>

// Input: S2 paperId → Output: list of referenced papers
ss.references(id: string): Promise<Paper[]>

// Input: S2 paperId → Output: list of citing papers
ss.citations(id: string): Promise<Paper[]>
```

Backend: Semantic Scholar API (free, no key, 100 req/5min).

### unpaywall.ts

```typescript
// Input: DOI → Output: OA PDF URL, null if no OA version
unpaywall.query(doi: string): Promise<string | null>
```

Backend: Unpaywall API (free, requires email in query param).

### pdf.ts

```typescript
// Input: PDF URL → Output: markdown full text (MinerU), null on failure
pdf.content(url: string): Promise<string | null>
```

Backend: MinerU cloud API (existing, vlm model).

### apify.ts

```typescript
// Input: keyword + opts → Output: Paper[] mapped from Google Scholar results
apify.googleScholarSearch(keyword: string, opts?: {
  maxItems?: number, newerThan?: number, sortBy?: "relevance" | "date"
}): Promise<Paper[]>
```

Backend: Apify REST API (`run-sync-get-dataset-items`), marco.gullo/google-scholar-scraper.

### brave.ts

```typescript
// Input: query + opts → Output: search result list (not Paper, these are web results)
brave.search(query: string, opts?: {
  count?: number
}): Promise<{title: string, url: string, description: string}[]>
```

Backend: Brave Search API (1K free/month).

### web.ts

```typescript
// Input: URL → Output: markdown full text, null on failure
web.content(url: string): Promise<string | null>
```

Backend: Apify rag-web-browser.

### markdown.ts

```typescript
// Input: title + content → Output: saved file path
markdown.save(title: string, content: string): Promise<string>
```

Uses processTitle for filename. Saves to DIR_CACHE from .env.

### misc.ts

```typescript
// Normalize title: lowercase, non-alphanum → _, no consecutive/leading/trailing _
misc.processTitle(title: string): string

// Deduplicate papers by normalizedTitle
misc.deduplicateByTitle(papers: Paper[]): Paper[]
```

## MCP Tools Layer

```
src/tools/
  arxiv_content.ts    — arxiv2markdown pipeline (thin wrapper)
  pdf_content.ts      — pdf2markdown pipeline (thin wrapper)
  paper_content.ts    — title2markdown pipeline (smart routing)
  paper_search.ts     — acd_search pipeline (search + dedup)
  web_search.ts       — web_search pipeline (thin wrapper)
  web_content.ts      — URL→markdown (thin wrapper)
  save_markdown.ts    — save pipeline (thin wrapper)
```

### MCP Tools Summary

| MCP Tool | Input | Output | Pipeline |
|----------|-------|--------|----------|
| `arxiv_content` | `{url}` | `{markdown}` | arxiv2markdown |
| `pdf_content` | `{url}` | `{markdown}` | pdf2markdown |
| `paper_content` | `{title}` | `{paper: Paper, markdown?}` | title2markdown |
| `paper_search` | `{topic, maxItems?, newerThan?}` | `{papers: Paper[]}` | acd_search |
| `web_search` | `{query, count?}` | `{results: [{title,url,desc}]}` | web search |
| `web_content` | `{url}` | `{markdown}` | URL→markdown |
| `save_markdown` | `{title, markdown}` | `{filepath}` | save |

### paper_content — Smart Routing (title2markdown pipeline)

```
title
  → arxiv.query(title)
    → arxivUrl? → arxiv.content(url) → save → return {paper, markdown}
    → null → ss.query(title)
      → doi? → unpaywall.query(doi)
        → pdfUrl? → pdf.content(pdfUrl) → save → return {paper, markdown}
      → ss.openAccessPdf? → pdf.content(pdfUrl) → save → return {paper, markdown}
      → none → return {paper, markdown: null}
```

### paper_search — Search + Dedup (acd_search pipeline)

```
topic
  → apify.googleScholarSearch(topic, opts)
  → for each result: detect arxiv source → fill arxivUrl
  → misc.deduplicateByTitle(papers)
  → return Paper[] (no full text, list only)
```

Search and fetch are separated. Claude Code decides which papers to fetch via paper_content.

## Skills Layer (Strategies)

```
skill/
  prometheus.md          — MCP tools reference (update)
  research_quick.md      — Quick literature search SOP
  research_survey.md     — Survey-style deep research SOP (DFS)
  research_web.md        — Web resource research SOP
```

### research_quick.md — Quick Literature Search

Scenario: understand a topic's current state, find key papers.

1. `paper_search({topic})` → paper list
2. Filter by year/citations
3. `paper_content({title})` for selected papers → markdown
4. `save_markdown` for each
5. Read and summarize

Single round, no recursion. Claude Code decides filtering criteria.

### research_survey.md — Survey-Style Deep Research (DFS)

Scenario: write a survey, comprehensively understand a field.

1. `paper_search({topic})` → initial paper list
2. `paper_content` for each → read and evaluate
3. For high-rated papers:
   a. `ss.references(s2Id)` → reference list
   b. Deduplicate against already-read set
   c. `paper_content` for valuable references
   d. Recurse until depth/breadth threshold
4. Thresholds decided by Claude Code based on topic complexity
   - Suggested starting values: maxDepth=2, maxWidth=5
   - Dynamically adjustable based on paper quality
5. Save all markdown, output structured survey

### research_web.md — Web Resource Research

Scenario: non-academic resources (blogs, docs, tutorials).

1. `web_search({query})` → URL list
2. Filter relevant URLs
3. `web_content({url})` for selected → markdown
4. `save_markdown` for each
5. Read and summarize

### Design Principles

- Skills describe strategy, never hardcode parameters
- Skills are composable: a full research session may chain quick → survey → web
- Claude Code has full autonomy on thresholds, filtering, and when to stop
- `prometheus.md` updated as tools reference manual

## Environment Variables

```
# Existing
MARKDOWN_DIR=.assets/markdown/    # legacy, may deprecate
TOKEN_MINERU=...                  # MinerU cloud API
TOKEN_APIFY=...                   # Apify REST API
API_KEY_CHAT=...                  # Alastor/OpenRouter
BASE_URL_CHAT=...
MODEL_CHAT=...

# New
DIR_CACHE=.assets/cache/          # all markdown output destination
TOKEN_BRAVE=...                   # Brave Search API key
EMAIL_UNPAYWALL=...               # Unpaywall API (email as identifier)
```

## Migration

- `src/utils_*.ts` → `src/utils/*.ts` (rename + refactor)
- `src/mcp_server.ts` → update to register new MCP tools from `src/tools/`
- `skill/apify.md` → deprecated, logic moved into tools layer
- `.mcp.json` → remove apify MCP server entry, keep only prometheus
- Old `evaluate_papers` tool → keep in utils_paper.ts or migrate later
