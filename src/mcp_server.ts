import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { pdfOcr } from "./utils_pdf.js";
import { arxivMarkdown } from "./utils_arxiv.js";
import { resolve, basename } from "path";
import { mkdirSync, writeFileSync } from "fs";

const MARKDOWN_DIR = resolve(process.env.MARKDOWN_DIR || ".assets/markdown");

function sanitizeName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const server = new McpServer({
  name: "prometheus",
  version: "0.1.0",
});

// --- Tools -----------------------------------------------------------

server.tool(
  "pdf2markdown",
  "Convert a PDF file to markdown via DeepSeek-OCR2 on Modal GPU. " +
  "Cold-start ~3min, then ~1min/page. Returns markdown text.",
  { pdf_path: z.string().describe("Absolute or relative path to the PDF file") },
  async ({ pdf_path }) => {
    try {
      const md = await pdfOcr({ path: pdf_path });
      return {
        content: [{ type: "text" as const, text: md }],
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `pdf2markdown failed: ${e.message}` }],
      };
    }
  }
);

server.tool(
  "arxiv2markdown",
  "Fetch the full markdown text of an arXiv paper. Provide at least id, url, or title.",
  {
    id:    z.string().optional().describe('arXiv ID, e.g. "2205.14135"'),
    url:   z.string().optional().describe('arXiv URL, e.g. "https://arxiv.org/abs/2205.14135"'),
    title: z.string().optional().describe('Paper title, e.g. "Attention Is All You Need"'),
  },
  async (args) => {
    try {
      const markdown = await arxivMarkdown(args);
      mkdirSync(MARKDOWN_DIR, { recursive: true });
      const label = args.id || args.title || args.url || "arxiv";
      const mdName = sanitizeName(label) + ".md";
      const mdPath = resolve(MARKDOWN_DIR, mdName);
      writeFileSync(mdPath, markdown, "utf-8");
      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `arxiv2markdown failed: ${e.message}` }],
      };
    }
  }
);

// --- Start -----------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
