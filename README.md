# Prometheus

any2md toolkit — convert any information source to AI-readable markdown.

## Quick Start

```bash
npm install
```

Set up `.env`:

```bash
MARKDOWN_DIR=.assets/markdown/
API_KEY_CHAT=your-openrouter-key
BASE_URL_CHAT=https://openrouter.ai/api/v1
MODEL_CHAT=moonshotai/kimi-k2.5
```

### Convert a PDF

```bash
# Via Modal CLI directly
modal run src/service_pdf_ocr.py --pdf-path path/to/file.pdf --output output.md

# Via TypeScript utility
npx tsx -e "import {pdfOcr} from './src/utils_pdf.js'; await pdfOcr({path: 'path/to/file.pdf'})"
```

### Fetch an arXiv paper

```bash
npx tsx -e "import {arxivMarkdown} from './src/utils_arxiv.js'; console.log(await arxivMarkdown({id: '2205.14135'}))"
```

### MCP Server (Claude Code integration)

```bash
npm run mcp
```

The `.mcp.json` config is included — Claude Code will auto-discover `pdf2markdown` and `arxiv2markdown` tools.

## Architecture

```bash
src/
├── service_pdf_ocr.py   # Modal GPU service (DeepSeek-OCR2 + vLLM)
├── utils_pdf.ts         # TS utility — calls Modal, returns content string
├── utils_arxiv.ts       # TS utility — arXiv API + arxiv2md.org, returns content string
├── utils_paper.ts       # TS utility — AI paper evaluation via Alastor SingleStepReasoning
├── utils_markdown.ts    # Shared — filename sanitization + save to MARKDOWN_DIR
└── mcp_server.ts        # MCP server — orchestrates utils, exposes tools
```

Local TS orchestration → remote compute (Modal GPU / arxiv2md API). Scale-to-zero, pay only for what you use.

## Tools

| Tool | Input | Output |
| ---- | ----- | ------ |
| `pdf2markdown` | PDF file path | Markdown file in `MARKDOWN_DIR` (with progress notifications) |
| `arxiv2markdown` | arXiv ID, URL, or title | Markdown file in `MARKDOWN_DIR` |
| `evaluate_papers` | List of arXiv papers + research topic | JSON with tier/recommendation per paper + saved markdown files |

## Requirements

- Node.js 18+
- Python 3.11+ with `modal` (`conda activate basic`)
- Modal account with GPU access

## Testing

```bash
npx tsx .test/test-all.ts       # Test all PDFs
npx tsx .test/test-arxiv.ts     # Test arXiv papers
npx tsx .test/test-evaluate.ts  # Test single paper AI evaluation
npx tsx .test/test-paper.ts     # Test batch paper evaluation (3 papers)
```

## License

[Apache-2.0 License](LICENSE)
