# Prometheus — Tool Reference

MCP server with 5 tools for academic research and web content retrieval. All tools cache results locally under `DIR_CACHE`.

## Tools

### paper_content

Convert a single paper to markdown. Smart routing based on input type.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `title` | string? | Paper title (triggers title→markdown pipeline) |
| `url` | string? | arXiv URL or PDF URL |
| `dir` | string? | Local PDF file path |

Routing logic:

- arXiv URL → fetch metadata by ID + convert via arxiv2md.org
- PDF URL or local path → convert via MinerU
- Title only → fallback chain: arXiv search → Semantic Scholar → Unpaywall OA PDF → MinerU

Returns `PaperResult` with `markdownDir` pointing to cached full-text.

### acd_search

Broad academic search. Queries Google Scholar, fetches full text for each result.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `query` | string | Search keywords for Google Scholar |

Pipeline: Google Scholar (via Apify) → for each paper, attempt arXiv content → fallback to title2markdown pipeline. Processes in batches of 3.

Returns `PaperResult[]` — each with metadata and `markdownDir` where content was obtained.

### dfs_search

Deep reference exploration. Follows a paper's references recursively via Semantic Scholar.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `title` | string | Paper title |
| `normalizedTitle` | string | Normalized title for dedup |
| `s2Id` | string? | Semantic Scholar paper ID (looked up if omitted) |
| `depth` | number | Max recursion depth |
| `breadth` | number | Max references per level |
| `visited` | string[]? | Already visited normalizedTitles |

Returns flat `PaperResult[]` of all discovered papers across all depth levels.

### web_search

Search the web via Brave Search API. Returns result list without content.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `query` | string | Search query |
| `count` | number? | Max results (default 10) |

Returns `WebResult[]` with `title`, `url`, `description`. Use `web_content` to fetch full page markdown.

### web_content

Fetch a web page and convert to markdown. Caches locally.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `url` | string | URL to fetch |
| `title` | string? | Page title (derived from URL if omitted) |

Returns `WebResult` with `markdownDir` pointing to cached markdown file.

## Data Types

```typescript
PaperResult {
  title, normalizedTitle,
  arxivId?, doi?, s2Id?,
  year?, authors?, abstract?, citationCount?,
  arxivUrl?, pdfUrl?, sourceUrl?,
  markdownDir?  // path to cached full-text markdown
}

WebResult {
  title, normalizedTitle, url,
  description?,
  markdownDir?  // path to cached page markdown
}
```

## Cache Structure

- `DIR_CACHE/markdown/` — paper full-text (.md)
- `DIR_CACHE/paper/` — paper metadata (.json)
- `DIR_CACHE/web/` — web page content (.md)

Filenames are normalized: lowercase, non-alphanumeric → `_`, no trailing `_`.

## Perplexity Tools (Paid — Use with Cost Awareness)

> **Priority order**: Always exhaust free tools (acd_search, web_search, dfs_search, paper_content) before using Perplexity tools. See Tool Priority Order below.

### pplx_search

Pure search via Perplexity. Returns ranked results. Cheapest Perplexity tool.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `query` | string | Search query |
| `max_results` | number? | Max results (default 5) |

Returns `PplxSearchResult[]` with `title`, `url`, `snippet`, `date`.

**When to use**: Tier 1-2 fallback when web_search/acd_search yield insufficient results.

### pplx_ask

Ask Perplexity a question. Returns grounded answer with citations.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `question` | string | The question to ask |
| `search_mode` | string? | `"web"` (default), `"academic"`, or `"sec"` |

Returns `PplxResult` with `answer` and `citations[]`.

**When to use**: Tier 2 fallback for gap validation, novelty checks, quick fact verification.

### pplx_pro_research

Multi-step Perplexity Pro research with cross-source reasoning.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `question` | string | Research question requiring multi-step reasoning |
| `system_prompt` | string? | Optional system prompt for focus |

Returns `PplxResult` with `answer` and `citations[]`.

**When to use**: Tier 3 tangential exploration. Max 1 call per pipeline.

### pplx_deep_research

Deep research: 20-50 automatic searches with cross-verification. Async.

| Param | Type | Description |
| ------- | ------ | ------------- |
| `question` | string | Detailed validation/research request |
| `timeout_ms` | number? | Timeout in ms (default 10 min) |

Returns `PplxResult` with `answer` and `citations[]`. Takes 1-3 minutes.

**When to use**: ONLY for mandatory stage-end validation (4x per pipeline). Never ad-hoc.

## Tool Priority Order

```
Priority 1 (free):     acd_search, web_search, dfs_search, paper_content
Priority 2 (cheap):    pplx_search ($0.005), pplx_ask (~$0.02)
Priority 3 (moderate): pplx_pro_research (~$0.05) — 1x per pipeline
Priority 4 (expensive): pplx_deep_research (~$0.40) — 4x mandatory only
```

MUST exhaust Priority 1 before using Priority 2. Priority 3-4 governed by protocol.
