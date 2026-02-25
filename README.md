# Prometheus

Vibe researching toolkit — AI-powered academic research automation, from literature discovery to deep analysis.

> [!NOTE]
> This is a work-in-progress personal project, under active development.

## What It Does

- Search and filter academic papers from Google Scholar
- Deep reference exploration via Semantic Scholar citation graphs
- Convert arXiv papers, PDFs, and web pages to AI-readable markdown
- Web search via Brave Search API for non-academic sources
- Full-text caching for offline access and repeated queries

## How It Works

Most academic AI tools only read abstracts to triage papers. Prometheus downloads the full paper text, converts it to markdown, and lets AI evaluate based on complete methodology, experiments, and discussion.

Three-layer architecture: atomic API wrappers (`utils/`) → pipeline orchestration (`tools/`) → MCP server registration (`mcp_server.ts`).

## Quick Start

```bash
npm install
```

Set up `.env`:

```bash
DIR_CACHE=.cache/
TOKEN_MINERU=your-mineru-token
TOKEN_APIFY=your-apify-token
TOKEN_BRAVE=your-brave-token
EMAIL_UNPAYWALL=your-email
```

### MCP Server

```bash
npm run mcp
```

The `.mcp.json` config is included — Claude Code will auto-discover all tools.

## Tools

| Tool | Description |
| ---- | ----------- |
| `paper_content` | Convert a paper to markdown (arXiv URL, PDF, or title → smart routing) |
| `acd_search` | Academic search via Google Scholar → fetch full text → cache |
| `dfs_search` | Deep reference exploration via DFS (Semantic Scholar references) |
| `web_search` | Search the web via Brave Search API |
| `web_content` | Fetch a web page as markdown and cache it |

## Architecture

```
MCP Client (Claude Code)
    │
    └── mcp_server.ts ─── tool registration
            │
            ├── tools/markdown.ts  → paper_content
            ├── tools/academic.ts  → acd_search, dfs_search
            └── tools/web.ts       → web_search, web_content
                    │
                    ├── utils/arxiv.ts     → arxiv2md.org, arXiv API
                    ├── utils/ss.ts        → Semantic Scholar
                    ├── utils/unpaywall.ts → Unpaywall
                    ├── utils/pdf.ts       → MinerU cloud API
                    ├── utils/apify.ts     → Apify (Google Scholar)
                    ├── utils/brave.ts     → Brave Search API
                    ├── utils/web.ts       → Apify rag-web-browser
                    └── utils/markdown.ts  → local file I/O
```

## License

[Apache-2.0 License](LICENSE)
