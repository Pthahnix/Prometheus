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
  async ({ pdf_path }, extra: any) => {
    try {
      const progressToken = extra?._meta?.progressToken;

      const content = await pdfOcr({
        path: pdf_path,
        onProgress: async ({ message, current, total }) => {
          // Structured progress notification
          if (progressToken !== undefined && current !== undefined && total !== undefined) {
            await extra.sendNotification({
              method: "notifications/progress",
              params: { progressToken, progress: current, total, message },
            });
          }
          // Logging message (always available)
          try {
            await server.sendLoggingMessage({ level: "info", data: message });
          } catch {}
        },
      });

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

// --- Experimental: progress test tool ---------------------------------

server.tool(
  "progress_test",
  "Test tool to verify MCP progress notifications. Simulates a 5-step task.",
  { input: z.string().optional().describe("Optional input, ignored") },
  async (_args: any, extra: any) => {
    const progressToken = extra?._meta?.progressToken;
    const log: string[] = [];
    log.push(`progressToken: ${progressToken ?? "NOT PROVIDED"}`);

    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 1000));

      // Approach 1: structured progress notification
      if (progressToken !== undefined) {
        await extra.sendNotification({
          method: "notifications/progress",
          params: { progressToken, progress: i, total: 5, message: `Step ${i}/5` },
        });
        log.push(`[progress] sent ${i}/5`);
      }

      // Approach 2: logging message
      try {
        await server.sendLoggingMessage({
          level: "info",
          data: `Progress: step ${i}/5 (${i * 20}%)`,
        });
        log.push(`[logging] sent step ${i}/5`);
      } catch (e: any) {
        log.push(`[logging] failed: ${e.message}`);
      }
    }

    return {
      content: [{ type: "text" as const, text: log.join("\n") }],
    };
  }
);

// --- Start -----------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
