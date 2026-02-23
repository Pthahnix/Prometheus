import "dotenv/config";
import { resolve, basename } from "path";
import { readFileSync } from "fs";
import AdmZip from "adm-zip";

const MINERU_BASE = "https://mineru.net/api/v4";
const TOKEN = process.env.TOKEN_MINERU;
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 600_000;

export type ProgressCallback = (info: {
  message: string;
  current?: number;
  total?: number;
}) => void | Promise<void>;

function headers(extra?: Record<string, string>): Record<string, string> {
  if (!TOKEN) throw new Error("TOKEN_MINERU not set in .env");
  return { Authorization: `Bearer ${TOKEN}`, ...extra };
}

async function apiPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${MINERU_BASE}${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`MinerU API error: ${json.msg ?? JSON.stringify(json)}`);
  return json.data;
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${MINERU_BASE}${path}`, {
    headers: headers(),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`MinerU API error: ${json.msg ?? JSON.stringify(json)}`);
  return json.data;
}

/** Extract .md content from a ZIP buffer. */
function extractMarkdownFromZip(zipBuf: Buffer): string {
  const zip = new AdmZip(zipBuf);
  const mdEntry = zip.getEntries().find(e => e.entryName.endsWith(".md"));
  if (!mdEntry) throw new Error("No .md file found in MinerU result ZIP");
  return mdEntry.getData().toString("utf-8");
}

/**
 * Convert a PDF to markdown via MinerU cloud API.
 * Returns the markdown content string.
 */
export async function pdf2Markdown({
  path: pdfPath,
  onProgress,
}: {
  path: string;
  onProgress?: ProgressCallback;
}): Promise<string> {
  const fullPath = resolve(pdfPath);
  const fileName = basename(fullPath);
  const pdfBuf = readFileSync(fullPath);

  // Step 1: Request presigned upload URL
  await onProgress?.({ message: "Requesting upload URL..." });
  const batchData = await apiPost("/file-urls/batch", {
    files: [{ name: fileName, is_ocr: true }],
    enable_formula: true,
    language: "en",
    model_version: "vlm",
  });
  const batchId: string = batchData.batch_id;
  const uploadUrl: string = batchData.file_urls?.[0];
  if (!batchId || !uploadUrl) {
    throw new Error("Failed to get batch_id or upload URL from MinerU");
  }

  // Step 2: Upload PDF to presigned URL (no extra headers for OSS presigned)
  await onProgress?.({ message: `Uploading ${fileName}...` });
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: pdfBuf,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
  }

  // Step 3: Poll for results
  await onProgress?.({ message: "Processing...", current: 0, total: 100 });
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    const result = await apiGet(`/extract-results/batch/${batchId}`);

    const state: string = result.extract_result?.[0]?.state ?? result.state;

    if (state === "done") {
      const zipUrl: string = result.extract_result[0].full_zip_url;
      if (!zipUrl) throw new Error("No full_zip_url in MinerU result");

      // Step 4: Download ZIP
      await onProgress?.({ message: "Downloading result...", current: 90, total: 100 });
      const zipRes = await fetch(zipUrl);
      if (!zipRes.ok) throw new Error(`ZIP download failed: ${zipRes.status}`);
      const zipBuf = Buffer.from(await zipRes.arrayBuffer());

      // Step 5: Extract markdown
      const markdown = extractMarkdownFromZip(zipBuf);
      await onProgress?.({ message: "Done", current: 100, total: 100 });
      return markdown;
    }

    if (state === "failed") {
      throw new Error("MinerU extraction failed");
    }

    // Report progress
    const pct = result.extract_result?.[0]?.progress ?? 0;
    await onProgress?.({
      message: `Processing... ${pct}%`,
      current: pct,
      total: 100,
    });
  }

  throw new Error(`MinerU polling timed out after ${POLL_TIMEOUT / 1000}s`);
}
