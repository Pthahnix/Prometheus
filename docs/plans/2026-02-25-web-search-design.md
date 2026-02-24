# Web Search Design

Date: 2026-02-25

## Overview

Add web search and content extraction to Prometheus. Two new utils (Brave Search API, Apify rag-web-browser), one new tool file with two MCP tools (web_search, web_content). Search and content extraction are separated — Claude Code decides which URLs to fetch.

## New Type — `src/types.ts`

```typescript
interface WebResult {
  title: string;
  normalizedTitle: string;
  url: string;
  description?: string;
  markdownDir?: string;
}
```

## Utils

### `src/utils/brave.ts`

```typescript
search(query: string, count?: number): Promise<WebResult[]>
```

- GET `https://api.search.brave.com/res/v1/web/search?q={query}&count={count}`
- Header: `X-Subscription-Token: {API_KEY_BRAVE}`
- Default count=10, maps `web.results[]` to WebResult
- Env: `API_KEY_BRAVE`

### `src/utils/web.ts`

```typescript
content(url: string): Promise<string | null>
```

- POST Apify `apify/rag-web-browser` via REST API
- Input: `{ query: url, maxResults: 1, outputFormats: ["markdown"] }`
- Returns markdown string or null
- Env: `TOKEN_APIFY` (shared with apify.ts)

## Tool — `src/tools/web.ts`

### `web_search`

- Input: `{ query: string, count?: number }`
- Pipeline: `brave.search(query, count)` → return `WebResult[]`
- No content fetching, list only

### `web_content`

- Input: `{ url: string, title?: string }`
- Pipeline: `web.content(url)` → save to `DIR_CACHE/web/` → return `WebResult` with markdownDir
- If no title provided, derive from URL

## Cache

```
DIR_CACHE/
  markdown/    # paper full text
  paper/       # paper metadata JSON
  web/         # web page markdown (new)
```

`utils/markdown.ts` gets new `saveWeb(title, markdown)` function targeting `DIR_CACHE/web/`.

## MCP Server

Register `web_search` and `web_content` in `mcp_server.ts`. Total: 5 tools.

## Changes

| Action | File |
|--------|------|
| Modify | `src/types.ts` — add WebResult |
| Create | `src/utils/brave.ts` |
| Create | `src/utils/web.ts` |
| Create | `src/tools/web.ts` |
| Modify | `src/utils/markdown.ts` — add saveWeb |
| Modify | `src/mcp_server.ts` — register 2 new tools |
| Modify | `CLAUDE.md` — update tool table |
