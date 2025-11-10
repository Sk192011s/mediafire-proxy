import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range, Accept, Accept-Encoding",
};

serve(async (req) => {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!target) {
    return new Response("Missing ?url=", { status: 400, headers });
  }

  try {
    const resp = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Deno Proxy)",
        "Referer": "https://www.mediafire.com/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    const contentType = resp.headers.get("content-type") || "text/html";
    const body = await resp.text();

    // fix relative links (so CSS, JS, images load correctly)
    const fixedBody = body.replace(/(href|src)="\/(?!\/)/g, `$1="https://www.mediafire.com/`);

    return new Response(fixedBody, {
      status: resp.status,
      headers: {
        ...headers,
        "content-type": contentType,
      },
    });
  } catch (e) {
    return new Response("Proxy Error: " + e.message, { status: 500, headers });
  }
});
