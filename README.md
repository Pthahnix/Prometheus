# Prometheus

any2md toolkit — convert any information source to AI-readable markdown.

## Quick Start

```bash
npm install
```

Set up `.env`:

```bash
MARKDOWN_DIR=.assets/markdown/
```

### Convert a PDF

```bash
# Via Modal CLI directly
modal run src/service_pdf_ocr.py --pdf-path path/to/file.pdf --output output.md

# Via TypeScript utility
npx tsx -e "import {pdfOcr} from './src/utils_pdf.js'; await pdfOcr({path: 'path/to/file.pdf'})"
```

### MCP Server (Claude Code integration)

```bash
npm run mcp
```

The `.mcp.json` config is included — Claude Code will auto-discover the `pdf_ocr` tool.

## Architecture

```bash
src/
├── service_pdf_ocr.py   # Modal GPU service (DeepSeek-OCR2 + vLLM)
├── utils_pdf.ts         # TS utility — calls Modal, saves to MARKDOWN_DIR
└── mcp_server.ts        # MCP server — exposes tools to Claude Code
```

Local TS orchestration → remote Modal GPU compute. Scale-to-zero, pay only for what you use.

## Tools

| Tool | Input | Output |
| ---- | ----- | ------ |
| `pdf_ocr` | PDF file path | Markdown file in `MARKDOWN_DIR` |

## Requirements

- Node.js 18+
- Python 3.11+ with `modal` (`conda activate basic`)
- Modal account with GPU access

## Testing

```bash
npm run test    # Runs all PDFs in .assets/pdf/ through the pipeline
```

## License

ISC
