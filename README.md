# Prometheus

Vibe researching toolkit — AI-powered academic research automation, from literature discovery to deep analysis.

> [!NOTE]
> This is a work-in-progress personal project, under active development.

Thin orchestration layer with fully serverless compute backend, accessed via MCP protocol.

## What It Does

- Search and filter academic papers from Google Scholar (arXiv sources)
- AI-evaluate papers: classify by tier (frontier / rising / foundational) and recommendation level
- Convert PDFs and arXiv papers to AI-readable markdown
- Dual-query strategy (recency + relevance) for comprehensive literature coverage

## Quick Start

```bash
npm install
```

Set up `.env`:

```bash
MARKDOWN_DIR=.assets/markdown/
API_KEY_CHAT=your-api-key
BASE_URL_CHAT=https://your-llm-provider/api/v1
MODEL_CHAT=your-model-name
```

### MCP Server

```bash
npm run mcp
```

The `.mcp.json` config is included — Claude Code will auto-discover all tools.

## Architecture

```bash
MCP Client (Claude Code)
    │
    └── mcp_server.ts (local orchestration)
            ├── utils_arxiv.ts    → arxiv2md API
            ├── utils_pdf.ts      → GPU serverless (OCR)
            ├── utils_paper.ts    → LLM serverless (evaluation)
            └── utils_markdown.ts → local file I/O
```

## Tools

| Tool | Description |
| ---- | ----------- |
| `pdf2markdown` | PDF → Markdown via GPU OCR |
| `arxiv2markdown` | arXiv paper → Markdown |
| `evaluate_papers` | Batch AI evaluation: tier + recommendation per paper |

## License

[Apache-2.0 License](LICENSE)
