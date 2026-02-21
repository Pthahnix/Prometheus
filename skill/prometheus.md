# Prometheus — any2md Toolkit

Convert any information source to AI-readable markdown.

## Available Tools

### pdf2markdown

Convert PDF files to markdown using DeepSeek-OCR2 on Modal GPU.
Best for: scanned papers, PDF ebooks, documents that can't be fetched from the web.
Sends real-time MCP progress notifications (page count, chunk progress, completion).

**Usage via MCP:**
The `prometheus` MCP server exposes `pdf2markdown` tool. Pass `pdf_path` (absolute or relative).

**Usage via code:**

```typescript
import { pdfOcr } from "./src/utils_pdf.js";
const md = await pdfOcr({ path: ".assets/pdf/paper.pdf" });
```

### arxiv2markdown

Fetch the full markdown text of an arXiv paper. Provide at least one of: id, url, or title.

**Usage via MCP:**
The `prometheus` MCP server exposes `arxiv2markdown` tool. Pass `id`, `url`, or `title`.

**Usage via code:**

```typescript
import { arxivMarkdown } from "./src/utils_arxiv.js";
const md = await arxivMarkdown({ id: "2205.14135" });
const md2 = await arxivMarkdown({ title: "Attention Is All You Need" });
```

**Output:** Markdown saved to `MARKDOWN_DIR` (default: `.assets/markdown/`).
Filename is sanitized: lowercase, special chars → `_`, no trailing `_`.

### evaluate_papers

Evaluate a list of arXiv papers for a research topic using AI. Downloads full text, saves markdown, and returns tier/recommendation for each paper. Batches of 3 papers concurrently.

Best for: automated literature review, research paper triage, vibe researching pipelines.
Designed to be called by the `apify` Google Scholar skill after arXiv filtering.

**Usage via MCP:**
The `prometheus` MCP server exposes `evaluate_papers` tool. Pass `papers` (array of `{title, year?, citations?, arxiv_url}`) and `query` (research topic).

**Usage via code:**

```typescript
import { evaluatePapers } from "./src/utils_paper.js";
const results = await evaluatePapers(
  [{ title: "Paper", arxiv_url: "https://arxiv.org/abs/..." }],
  "research topic",
  async (p) => console.log(p.message),
);
```

**Output per paper:**

- `tier`: `frontier` (recent, novel) / `rising` (gaining traction) / `foundational` (landmark)
- `recommendation`: `low` (summary only) / `medium` (worth reading) / `high` (core paper, track citations)
- `summary`: 2-3 sentence overview
- `key_contributions`: list of core contributions
- `markdown_path`: saved full-text markdown path

## Architecture

- `src/utils_*.ts` — TS utility functions (local orchestration)
- `src/service_*.py` — Modal backend services (remote GPU compute)
- `src/mcp_server.ts` — MCP server entry point

## Notes

- Modal services are deploy-on-invoke (cold start ~3min, then ~1min/page)
- Set `MARKDOWN_DIR` in `.env` to change output directory
- Run `modal run src/service_pdf_ocr.py --pdf-path <file>` for direct CLI usage
