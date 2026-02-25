import "dotenv/config";
import type { PplxSearchResult } from "../types.js";

const API_KEY = process.env.API_KEY_PERPLEXITY;
const BASE_URL = "https://api.perplexity.ai";

export function headers() {
  if (!API_KEY) throw new Error("API_KEY_PERPLEXITY not set in .env");
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ── Search API ──────────────────────────────────────────────────────

export interface SearchOptions {
  search_domain_filter?: string[];
  search_language_filter?: string[];
  country?: string;
  max_results?: number;
  max_tokens_per_page?: number;
  max_tokens?: number;
}

export async function search(
  query: string,
  options?: SearchOptions,
): Promise<PplxSearchResult[]> {
  const body: Record<string, unknown> = { query };
  if (options?.search_domain_filter) body.search_domain_filter = options.search_domain_filter;
  if (options?.search_language_filter) body.search_language_filter = options.search_language_filter;
  if (options?.country) body.country = options.country;
  if (options?.max_results) body.max_results = options.max_results;
  if (options?.max_tokens_per_page) body.max_tokens_per_page = options.max_tokens_per_page;
  if (options?.max_tokens) body.max_tokens = options.max_tokens;

  const resp = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Perplexity Search API error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const results: PplxSearchResult[] = (data.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.snippet ?? r.description ?? "",
    date: r.date ?? undefined,
  }));
  return results;
}
