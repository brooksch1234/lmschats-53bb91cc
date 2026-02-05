import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (query param) and POST (JSON body)
    let url: string | null = null;
    let rawMode = false;
    
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      url = params.get("url");
      rawMode = params.get("raw") === "true";
    } else {
      const body = await req.json();
      url = body.url;
      rawMode = body.raw === true;
    }

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Proxying request to: " + url + (rawMode ? " (raw mode)" : ""));

    // Validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the target URL
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      console.error("Failed to fetch " + url + ": " + response.status + " " + response.statusText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch page: " + response.status + " " + response.statusText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    
    // For non-HTML content or raw mode, pass through directly
    if (!contentType.includes("text/html")) {
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        headers: { 
          ...corsHeaders, 
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        }
      });
    }

    let html = await response.text();
    const baseUrl = targetUrl.protocol + "//" + targetUrl.host;

    // Add base tag for relative resources
    const baseTag = "<base href=\"" + baseUrl + "/\" target=\"_self\">";
    if (html.includes("<head>")) {
      html = html.replace("<head>", "<head>\n" + baseTag);
    } else if (html.includes("<HEAD>")) {
      html = html.replace("<HEAD>", "<HEAD>\n" + baseTag);
    } else if (html.match(/<head[^>]*>/i)) {
      html = html.replace(/<head[^>]*>/i, function(match) { return match + "\n" + baseTag; });
    } else {
      html = "<!DOCTYPE html><html><head>" + baseTag + "</head><body>" + html + "</body></html>";
    }

    // Rewrite relative src attributes
    html = html.replace(/src="(?!http|\/\/|data:|blob:|javascript:)([^"]+)"/gi, function(_m, path) {
      const abs = path.startsWith("/") ? baseUrl + path : baseUrl + "/" + path;
      return "src=\"" + abs + "\"";
    });
    
    html = html.replace(/src='(?!http|\/\/|data:|blob:|javascript:)([^']+)'/gi, function(_m, path) {
      const abs = path.startsWith("/") ? baseUrl + path : baseUrl + "/" + path;
      return "src='" + abs + "'";
    });

    // Rewrite relative href attributes
    html = html.replace(/href="(?!http|\/\/|#|javascript:|mailto:|tel:|data:)([^"]+)"/gi, function(_m, path) {
      const abs = path.startsWith("/") ? baseUrl + path : baseUrl + "/" + path;
      return "href=\"" + abs + "\"";
    });
    
    html = html.replace(/href='(?!http|\/\/|#|javascript:|mailto:|tel:|data:)([^']+)'/gi, function(_m, path) {
      const abs = path.startsWith("/") ? baseUrl + path : baseUrl + "/" + path;
      return "href='" + abs + "'";
    });

    // Rewrite CSS url() references
    html = html.replace(/url\(["']?(?!http|\/\/|data:|blob:)([^"')]+)["']?\)/gi, function(_m, path) {
      if (path.startsWith("#")) return _m;
      const abs = path.startsWith("/") ? baseUrl + path : baseUrl + "/" + path;
      return "url(\"" + abs + "\")";
    });

    console.log("Successfully proxied: " + url);

    // Raw mode returns HTML directly (for iframe embedding)
    if (rawMode) {
      return new Response(html, {
        status: response.status,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "text/html; charset=utf-8",
        }
      });
    }

    // Default: return JSON with content
    return new Response(
      JSON.stringify({ content: html, url: targetUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Proxy error:", error);
    const message = error instanceof Error ? error.message : "Failed to proxy request";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
