import "dotenv/config";
import { spawn } from "child_process";
import { resolve, basename, dirname } from "path";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_SCRIPT = resolve(__dirname, "service_pdf_ocr.py");
const MARKDOWN_DIR = resolve(process.env.MARKDOWN_DIR || ".assets/markdown");

/** Sanitize PDF filename → lowercase, no special chars, no trailing _ */
function sanitizeName(pdfPath: string): string {
  return basename(pdfPath)
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/_$/, "")
    + ".md";
}

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
 * Returns the markdown string. Also saves to MARKDOWN_DIR.
 */
export async function pdfOcr({ path }: { path: string }): Promise<string> {
  const pdfPath = resolve(path);
  const mdName = sanitizeName(pdfPath);
  const mdPath = resolve(MARKDOWN_DIR, mdName);

  mkdirSync(MARKDOWN_DIR, { recursive: true });

  const projectRoot = resolve(__dirname, "..");
  await run("modal", [
    "run", SERVICE_SCRIPT,
    "--pdf-path", pdfPath,
    "--output", mdPath,
  ], projectRoot);

  console.log(`[utils_pdf] Saved: ${mdPath}`);
  return mdPath;
}
