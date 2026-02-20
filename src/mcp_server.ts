import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { pdfOcr } from "./utils_pdf.js";

const server = new McpServer({
  name: "prometheus",
  version: "0.1.0",
});

// --- Tools -----------------------------------------------------------

server.tool(
  "pdf_ocr",
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
        content: [{ type: "text" as const, text: `pdf_ocr failed: ${e.message}` }],
      };
    }
  }
);

// --- Start -----------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
