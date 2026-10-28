const MAX_QUERY_LENGTH = 180;
const MAX_RESULTS = 10;

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function textOnly(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}
function getAttribute(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return (tag.match(re) || [])[2] || '';
}
function normalizeResultUrl(raw) {
  try {
    const href = decodeHtml(raw);
    const url = new URL(href, 'https://duckduckgo.com/');
    if (url.hostname.endsWith('duckduckgo.com') && url.pathname === '/l/') {
      const redirected = url.searchParams.get('uddg');
      if (redirected) return normalizeResultUrl(redirected);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.hostname === 'duckduckgo.com' || url.hostname.endsWith('.duckduckgo.com')) return null;
    return url.href;
  } catch { return null; }
}
function parseResults(html) {
  const links = [];
  const linkRe = /<a\b([^>]*\bclass\s*=\s*["'][^"']*\bresult__a\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(html)) && links.length < MAX_RESULTS) {
    const rawUrl = getAttribute(match[1], 'href');
    const url = normalizeResultUrl(rawUrl);
    const title = textOnly(match[2]);
    if (!url || !title) continue;
    links.push({ url, title, snippet: '', domain: new URL(url).hostname.replace(/^www\./, '') });
  }
  const snippetRe = /<a\b([^>]*\bclass\s*=\s*["'][^"']*\bresult__snippet\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const snippets = [];
  while ((match = snippetRe.exec(html)) && snippets.length < MAX_RESULTS) snippets.push(textOnly(match[2]));
  links.forEach((item, i) => { item.snippet = snippets[i] || ''; });
  return links;
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) return Response.json({ results: [] });
  if (query.length > MAX_QUERY_LENGTH) return Response.json({ error: 'Search query is too long.' }, { status: 400 });

  const cacheKey = new Request(`${url.origin}/api/search-cache?q=${encodeURIComponent(query.toLowerCase())}`);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const body = new URLSearchParams({ q: query });
    const upstream = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'Mozilla/5.0 (compatible; WebSpaceSearch/1.0; +https://developers.cloudflare.com/pages/)'
      },
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!upstream.ok) throw new Error(`Search provider returned ${upstream.status}`);
    const html = await upstream.text();
    const results = parseResults(html);
    const response = Response.json({ results, provider: 'DuckDuckGo' }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=300' }
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    return Response.json({ error: 'Search is temporarily unavailable.' }, { status: 502 });
  }
}
