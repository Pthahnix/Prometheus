import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { basename } from "path";
import { pdfOcr } from "./utils_pdf.js";
import { arxivMarkdown, arxivTitle } from "./utils_arxiv.js";
import { markdownFilename, markdownSave } from "./utils_markdown.js";

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
      const content = await pdfOcr({ path: pdf_path });
      const filename = markdownFilename(basename(pdf_path));
      const mdPath = markdownSave(content, filename);
      return {
        content: [{ type: "text" as const, text: mdPath }],
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
      const title = await arxivTitle(args);
      const content = await arxivMarkdown(args);
      const filename = markdownFilename(title);
      const mdPath = markdownSave(content, filename);
      return {
        content: [{ type: "text" as const, text: mdPath }],
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
