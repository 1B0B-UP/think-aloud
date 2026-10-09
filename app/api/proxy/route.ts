export const runtime = "nodejs";

// Allowed domains — only proxy content from these sources
const ALLOWED = [
  "en.wikipedia.org",
  "en.m.wikipedia.org",
  "commons.wikimedia.org",
];

export async function GET(req: Request) {
  const url       = new URL(req.url);
  const targetRaw = url.searchParams.get("url");

  if (!targetRaw) {
    return new Response("Missing ?url= parameter", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(targetRaw);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (!ALLOWED.includes(target.hostname)) {
    return new Response("Domain not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TeMatemataFeed/1.0 educational app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const html = await upstream.text();

    // Inject a <base> tag so relative URLs (CSS, images, links) resolve correctly
    const origin    = `${target.protocol}//${target.hostname}`;
    const baseTag   = `<base href="${origin}/" target="_self">`;
    // Also inject minimal style overrides to make it look clean inside the popup
    const styleTag  = `<style>
      body { background: #fff !important; }
      #mw-navigation, .mw-navigation, #p-logo, .portal, #footer,
      #mw-head, .mw-header, .vector-header-container,
      #siteNotice, .mw-indicators { display: none !important; }
      #content, .mw-body, #mw-content-text { margin: 0 !important; padding: 16px !important; }
    </style>`;

    const fixed = html
      .replace(/<head>/i,         `<head>${baseTag}${styleTag}`)
      .replace(/<head\s[^>]*>/i,  (m) => `${m}${baseTag}${styleTag}`);

    return new Response(fixed, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Intentionally NOT setting X-Frame-Options — that's the whole point
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return new Response(`Proxy error: ${(err as Error).message}`, { status: 502 });
  }
}
