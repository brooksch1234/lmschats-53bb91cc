import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");
    
    if (!targetUrl) {
      return new Response("Missing url parameter", { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log("Proxying request to: " + targetUrl);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new Response("Invalid URL format", { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "text/html";
    const baseUrl = parsedUrl.protocol + "//" + parsedUrl.host;

    if (contentType.includes("text/html")) {
      let html = await response.text();

      const baseTag = "<base href=\"" + baseUrl + "/\" target=\"_self\">";
      if (html.includes("<head>")) {
        html = html.replace("<head>", "<head>\n" + baseTag);
      } else if (html.includes("<HEAD>")) {
        html = html.replace("<HEAD>", "<HEAD>\n" + baseTag);
      } else {
        html = "<!DOCTYPE html><html><head>" + baseTag + "</head><body>" + html + "</body></html>";
      }

      html = html.replace(/src="(?!http|\/\/|data:|blob:|javascript:)([^"]+)"/gi, function(_m: string, path: string) {
        const abs = path.startsWith("/") ? baseUrl + path : baseUrl + "/" + path;
        return "src=\"" + abs + "\"";
      });

      html = html.replace(/href="(?!http|\/\/|#|javascript:|mailto:|tel:|data:)([^"]+)"/gi, function(_m: string, path: string) {
        const abs = path.startsWith("/") ? baseUrl + path : baseUrl + "/" + path;
        return "href=\"" + abs + "\"";
      });

      console.log("Successfully processed HTML");

      return new Response(html, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    const body = await response.arrayBuffer();
    
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Proxy error:", message);
    return new Response("Proxy error: " + message, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
