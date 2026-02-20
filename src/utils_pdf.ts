import "dotenv/config";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_SCRIPT = resolve(__dirname, "service_pdf_ocr.py");

export type ProgressCallback = (info: {
  message: string;
  current?: number;
  total?: number;
}) => void | Promise<void>;

/** Run a command and return stdout. Rejects on non-zero exit. */
function run(
  cmd: string,
  args: string[],
  cwd: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let totalPages: number | undefined;

    // Queue to serialize async progress calls from sync event handlers
    let progressQueue = Promise.resolve();
    const safeProgress = (info: Parameters<ProgressCallback>[0]) => {
      if (!onProgress) return;
      progressQueue = progressQueue.then(() =>
        Promise.resolve(onProgress(info)).catch(() => {})
      );
    };

    const parseLine = (line: string) => {
      if (!onProgress) return;
      const pagesMatch = line.match(/\[pdf_ocr\]\s+.+:\s+(\d+)\s+pages/);
      if (pagesMatch) {
        totalPages = parseInt(pagesMatch[1], 10);
        safeProgress({ message: `${totalPages} pages detected`, current: 0, total: totalPages });
        return;
      }
      const chunkMatch = line.match(/\[pdf_ocr\]\s+chunk\s+(\d+)-(\d+)\/(\d+)/);
      if (chunkMatch) {
        const end = parseInt(chunkMatch[2], 10);
        const total = parseInt(chunkMatch[3], 10);
        totalPages = total;
        safeProgress({ message: `Pages ${chunkMatch[1]}-${chunkMatch[2]} of ${total}`, current: end, total });
        return;
      }
      if (line.includes("[pdf_ocr] Done")) {
        safeProgress({ message: "OCR complete", current: totalPages, total: totalPages });
        return;
      }
      if (line.includes("Uploading")) {
        safeProgress({ message: line.trim() });
        return;
      }
    };

    let stdoutBuf = "";
    let stderrBuf = "";

    proc.stdout.on("data", (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      stdoutBuf += s;
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() || "";
      for (const line of lines) parseLine(line);
    });

    proc.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(d);
      stderrBuf += s;
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() || "";
      for (const line of lines) parseLine(line);
    });

    proc.on("close", (code) => {
      if (stdoutBuf) parseLine(stdoutBuf);
      if (stderrBuf) parseLine(stderrBuf);
      // Wait for queued progress notifications to flush before resolving
      progressQueue.then(() => {
        code === 0 ? resolve(stdout) : reject(new Error(`Exit ${code}\n${stderr}`));
      });
    });
  });
}

/**
 * Convert a PDF to markdown via DeepSeek-OCR2 on Modal GPU.
 * Returns the markdown content string.
 */
export async function pdfOcr({
  path,
  onProgress,
}: {
  path: string;
  onProgress?: ProgressCallback;
}): Promise<string> {
  const pdfPath = resolve(path);
  const tmpPath = resolve(tmpdir(), `prometheus_${Date.now()}.md`);

  const projectRoot = resolve(__dirname, "..");
  await run("modal", [
    "run", SERVICE_SCRIPT,
    "--pdf-path", pdfPath,
    "--output", tmpPath,
  ], projectRoot, onProgress);

  const content = readFileSync(tmpPath, "utf-8");
  return content;
}
