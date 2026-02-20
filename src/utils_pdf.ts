import "dotenv/config";
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { readFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_SCRIPT = resolve(__dirname, "service_pdf_ocr.py");

/** Run a command and return stdout. Rejects on non-zero exit. */
function run(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d; process.stdout.write(d); });
    proc.stderr.on("data", (d) => { stderr += d; process.stderr.write(d); });
    proc.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`Exit ${code}\n${stderr}`))
    );
  });
}

/**
 * Convert a PDF to markdown via DeepSeek-OCR2 on Modal GPU.
 * Returns the markdown content string.
 */
export async function pdfOcr({ path }: { path: string }): Promise<string> {
  const pdfPath = resolve(path);
  const tmpPath = resolve(tmpdir(), `prometheus_${Date.now()}.md`);

  const projectRoot = resolve(__dirname, "..");
  await run("modal", [
    "run", SERVICE_SCRIPT,
    "--pdf-path", pdfPath,
    "--output", tmpPath,
  ], projectRoot);

  const content = readFileSync(tmpPath, "utf-8");
  return content;
}
