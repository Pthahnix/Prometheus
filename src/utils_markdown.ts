import "dotenv/config";
import { resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";

const MARKDOWN_DIR = resolve(process.env.MARKDOWN_DIR || ".assets/markdown");

/** Sanitize a name into a safe markdown filename (with .md extension). */
export function markdownFilename(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    + ".md";
}

/** Save markdown content to MARKDOWN_DIR/<filename> and return the absolute path. */
export function markdownSave(markdownContent: string, filename: string): string {
  mkdirSync(MARKDOWN_DIR, { recursive: true });
  const mdPath = resolve(MARKDOWN_DIR, filename);
  writeFileSync(mdPath, markdownContent, "utf-8");
  return mdPath;
}
