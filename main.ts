import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Accept, Accept-Encoding",
  };
}

function extractDirectUrlFromHtml(html: string): string | null {
  const re = /https?:\/\/download(?:\.[\w-]+)*\.mediafire\.com\/[^\s"'<>]+/i;
  const m = html.match(re);
  if (m) return m[0];
  const re2 = /"downloadUrl"\s*:\s*"([^"]+)"/i;
  const m2 = html.match(re2);
  if (m2) return m2[1].replace(/\\u002F/g, "/");
  return null;
}

async function fetchWithRange(url: string, range?: string) {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Deno Proxy)",
    "Accept": "*/*",
    "Referer": "https://www.mediafire.com/",
  };
  if (range) headers["Range"] = range;
  return fetch(url, { headers, redirect: "follow" });
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const urlObj = new URL(req.url);
    const target = urlObj.searchParams.get("url");
    if (!target) {
      return new Response("missing url param", { status: 400, headers: corsHeaders() });
    }

    const clientRange = req.headers.get("range") || undefined;
    const first = await fetchWithRange(target);
    const type = first.headers.get("content-type") || "";

    let final = first;
    if (type.includes("text/html")) {
      const html = await first.text();
      const direct = extractDirectUrlFromHtml(html);
      if (!direct) {
        return new Response("cannot extract direct link", {
          status: 502,
          headers: corsHeaders(),
        });
      }
      final = await fetchWithRange(direct, clientRange);
    } else if (clientRange) {
      final = await fetchWithRange(target, clientRange);
    }

    const h: Record<string, string> = { ...corsHeaders() };
    ["content-type", "content-length", "content-disposition", "accept-ranges", "content-range"].forEach(k => {
      const v = final.headers.get(k);
      if (v) h[k] = v;
    });

    return new Response(final.body, { status: final.status, headers: h });
  } catch (err) {
    console.error(err);
    return new Response("proxy error", { status: 500, headers: corsHeaders() });
  }
});
