// src/utils/arxiv_utils.ts

import 'dotenv/config';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

// ── Constants ────────────────────────────────────────────────────────

const BASE_URL_ARXIV     = process.env['BASE_URL_ARXIV']     ?? 'https://arxiv.org/abs/';
const BASE_URL_ARXIV_API = process.env['BASE_URL_ARXIV_API'] ?? 'https://export.arxiv.org/api/query';
const BASE_URL_ARXIV2MD  = process.env['BASE_URL_ARXIV2MD']  ?? 'https://arxiv2md.org/api/ingest';

// ── Sync Helpers ─────────────────────────────────────────────────────

function id_2_id(id: string): string {
  return id.replace(/^arXiv:/i, '').replace(/v\d+$/, '');
}

function id_2_url(id: string): string {
  return BASE_URL_ARXIV + id;
}

function url_2_id(url: string): string {
  const m = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?/i);
  if (!m) throw new Error(`invalid arxiv url: ${url}`);
  return m[1];
}

function url_2_url(url: string): string {
  return id_2_url(url_2_id(url));
}

// ── Async Helpers ────────────────────────────────────────────────────

async function url_2_title(url: string): Promise<string> {
  const id = url_2_id(url);
  const params = new URLSearchParams({ id_list: id });
  const resp = await fetch(`${BASE_URL_ARXIV_API}?${params}`);
  if (!resp.ok) throw new Error(`arXiv API ${resp.status}`);
  const parsed = new XMLParser().parse(await resp.text());
  const entry = Array.isArray(parsed?.feed?.entry) ? parsed.feed.entry[0] : parsed?.feed?.entry;
  if (!entry?.title) throw new Error(`no title found for ${id}`);
  return String(entry.title).replace(/\s+/g, ' ').trim();
}

async function id_2_title(id: string): Promise<string> {
  return url_2_title(id_2_url(id));
}

async function title_2_url(title: string): Promise<string> {
  const params = new URLSearchParams({ search_query: `ti:"${title}"` });
  const resp = await fetch(`${BASE_URL_ARXIV_API}?${params}`);
  if (!resp.ok) throw new Error(`arXiv API ${resp.status}`);
  const parsed = new XMLParser().parse(await resp.text());
  const entry = Array.isArray(parsed?.feed?.entry) ? parsed.feed.entry[0] : parsed?.feed?.entry;
  if (!entry?.id) throw new Error(`no paper found for title: ${title}`);
  return url_2_url(String(entry.id));
}

async function title_2_id(title: string): Promise<string> {
  return url_2_id(await title_2_url(title));
}

async function title_2_title(title: string): Promise<string> {
  const params = new URLSearchParams({ search_query: `ti:"${title}"` });
  const resp = await fetch(`${BASE_URL_ARXIV_API}?${params}`);
  if (!resp.ok) throw new Error(`arXiv API ${resp.status}`);
  const parsed = new XMLParser().parse(await resp.text());
  const entry = Array.isArray(parsed?.feed?.entry) ? parsed.feed.entry[0] : parsed?.feed?.entry;
  if (!entry?.title) throw new Error(`no title found for: ${title}`);
  return String(entry.title).replace(/\s+/g, ' ').trim();
}

// ── Exported Functions ───────────────────────────────────────────────

type ArxivInput = { id?: string; url?: string; title?: string };

export async function arxivId({ id, url, title }: ArxivInput = {}): Promise<string> {
  if (id)    return id_2_id(id);
  if (url)   return url_2_id(url_2_url(url));
  if (title) return title_2_id(await title_2_title(title));
  throw new Error('arxivId: provide at least one of id, url, title');
}

export async function arxivUrl({ id, url, title }: ArxivInput = {}): Promise<string> {
  if (id)    return id_2_url(id_2_id(id));
  if (url)   return url_2_url(url);
  if (title) return title_2_url(await title_2_title(title));
  throw new Error('arxivUrl: provide at least one of id, url, title');
}

export async function arxivTitle({ id, url, title }: ArxivInput = {}): Promise<string> {
  if (id)    return id_2_title(id_2_id(id));
  if (url)   return url_2_title(url_2_url(url));
  if (title) return title_2_title(title);
  throw new Error('arxivTitle: provide at least one of id, url, title');
}

export async function arxivMarkdown({ id, url, title }: ArxivInput = {}): Promise<string> {
  let cleanId    = id    ? id_2_id(id)       : undefined;
  let cleanUrl   = url   ? url_2_url(url)    : undefined;
  let cleanTitle = title ? await title_2_title(title) : undefined;

  if (cleanId && !cleanUrl)    cleanUrl   = id_2_url(cleanId);
  if (cleanUrl && !cleanId)    cleanId    = url_2_id(cleanUrl);
  if (!cleanUrl && cleanTitle) {
    cleanUrl = await title_2_url(cleanTitle);
    cleanId  = url_2_id(cleanUrl);
  }
  if (!cleanTitle && cleanUrl) cleanTitle = await url_2_title(cleanUrl);

  if (!cleanUrl || !cleanTitle) throw new Error('arxivMarkdown: provide at least one of id, url, title');

  const resp = await fetch(BASE_URL_ARXIV2MD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_text: cleanUrl }),
  });
  if (!resp.ok) throw new Error(`arxiv2md ${resp.status}`);
  const data = await resp.json() as { content?: string };
  if (!data.content) throw new Error('arxiv2md returned empty');
  return '# ' + cleanTitle + '\n\n' + data.content;
}
