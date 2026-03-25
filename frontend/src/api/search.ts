import type { SearchResponse } from '../types';

const API_BASE = '/api';

export async function searchPapers(
  query: string,
  options: {
    perPage?: number;
    ctx?: number;
    regex?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<SearchResponse> {
  const { perPage = 20, ctx = 2, regex = false, signal } = options;

  const params = new URLSearchParams({
    q: query,
    per_page: String(perPage),
    ctx: String(ctx),
    regex: String(regex),
  });

  const resp = await fetch(`${API_BASE}/search?${params}`, { signal });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Search failed: ${resp.status} ${body}`);
  }

  return resp.json();
}
