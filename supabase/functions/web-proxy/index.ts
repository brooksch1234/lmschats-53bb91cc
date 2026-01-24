import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Proxying request to: ${url}`);

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
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch page: ${response.status} ${response.statusText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    
    // Only process HTML content
    if (!contentType.includes("text/html")) {
      return new Response(
        JSON.stringify({ error: "Only HTML pages are supported" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let html = await response.text();
    const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;

    // Rewrite relative URLs to absolute
    // Fix src attributes
    html = html.replace(/src=["'](?!http|\/\/|data:)([^"']+)["']/gi, (match, path) => {
      const absolutePath = path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
      return `src="${absolutePath}"`;
    });

    // Fix href attributes
    html = html.replace(/href=["'](?!http|\/\/|#|javascript:|mailto:|tel:)([^"']+)["']/gi, (match, path) => {
      const absolutePath = path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
      return `href="${absolutePath}"`;
    });

    // Fix CSS url() references
    html = html.replace(/url\(["']?(?!http|\/\/|data:)([^"')]+)["']?\)/gi, (match, path) => {
      const absolutePath = path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
      return `url("${absolutePath}")`;
    });

    // Add base tag for any remaining relative resources
    if (!html.includes("<base")) {
      html = html.replace(/<head[^>]*>/i, (match) => `${match}<base href="${baseUrl}/" target="_blank">`);
    }

    // Remove scripts to prevent security issues and broken functionality
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<script[^>]*\/>/gi, "");

    // Add styling to contain content
    const containerStyle = `
      <style>
        body { 
          max-width: 100%; 
          overflow-x: hidden; 
          margin: 0; 
          padding: 16px;
        }
        img { max-width: 100%; height: auto; }
        * { box-sizing: border-box; }
      </style>
    `;
    html = html.replace(/<\/head>/i, `${containerStyle}</head>`);

    console.log(`Successfully proxied: ${url}`);

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
