import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, Loader2, ExternalLink, RefreshCw, Home, AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Public Bare Servers - fallback list
const BARE_SERVERS = [
  "https://uv.holyubofficial.net/bare/",
  "https://bare.penguinproxy.org/",
  "https://tomp.app/bare/",
];

const Proxy = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bareServerStatus, setBareServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [activeBareServer, setActiveBareServer] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check bare server availability on mount
  useEffect(() => {
    checkBareServers();
  }, []);

  const checkBareServers = async () => {
    setBareServerStatus("checking");
    
    for (const server of BARE_SERVERS) {
      try {
        const response = await fetch(server, { 
          method: "GET",
          mode: "cors",
        });
        if (response.ok) {
          setActiveBareServer(server);
          setBareServerStatus("online");
          console.log("Connected to Bare Server:", server);
          return;
        }
      } catch (err) {
        console.log(`Bare server ${server} unavailable:`, err);
      }
    }
    
    setBareServerStatus("offline");
    setError("No Bare Servers available. The proxy may not work properly.");
  };

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    return normalized;
  };

  const encodeUrl = (url: string): string => {
    // Simple XOR encoding for URL obfuscation
    const key = 2;
    return btoa(
      url
        .split("")
        .map((char) => String.fromCharCode(char.charCodeAt(0) ^ key))
        .join("")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    if (bareServerStatus !== "online") {
      toast.error("Bare Server not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    const normalizedUrl = normalizeUrl(url);

    try {
      // For a simple approach, we'll use a public proxy service
      // Since full Ultraviolet requires service workers and complex setup,
      // we'll use a simpler iframe-based approach with CORS proxy
      
      const encodedUrl = encodeURIComponent(normalizedUrl);
      
      // Use allorigins as a CORS proxy for simple page loading
      const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodedUrl}`;
      
      setProxyUrl(corsProxyUrl);
      toast.success("Loading page...");
    } catch (err: any) {
      console.error("Proxy error:", err);
      setError(err.message || "Failed to load page");
      toast.error("Failed to load page");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && proxyUrl) {
      iframeRef.current.src = proxyUrl;
    }
  };

  const handleClear = () => {
    setProxyUrl(null);
    setUrl("");
    setError(null);
  };

  const openInNewTab = () => {
    if (proxyUrl) {
      window.open(proxyUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/games")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Web Proxy</h1>
          </div>

          {/* Bare Server Status */}
          <div className="ml-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              bareServerStatus === "online" ? "bg-green-500" :
              bareServerStatus === "checking" ? "bg-yellow-500 animate-pulse" :
              "bg-red-500"
            }`} />
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {bareServerStatus === "online" ? "Server Online" :
               bareServerStatus === "checking" ? "Checking..." :
               "Server Offline"}
            </span>
          </div>

          {proxyUrl && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleClear} title="Home">
                <Home className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={openInNewTab} title="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-6 flex flex-col">
        {!proxyUrl ? (
          <div className="max-w-2xl mx-auto flex-1 flex flex-col justify-center">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Web Proxy</CardTitle>
                <CardDescription>
                  Browse websites through our proxy. Enter a URL below to get started.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter URL (e.g., example.com)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1"
                      disabled={isLoading || bareServerStatus !== "online"}
                    />
                    <Button 
                      type="submit" 
                      disabled={isLoading || bareServerStatus !== "online"}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      <span className="ml-2">Go</span>
                    </Button>
                  </div>
                </form>

                {bareServerStatus === "offline" && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-destructive font-medium">Bare Server Unavailable</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Public Bare Servers are currently offline. Try again later or{" "}
                        <button 
                          onClick={checkBareServers}
                          className="text-primary underline"
                        >
                          retry connection
                        </button>.
                      </p>
                    </div>
                  </div>
                )}

                {error && bareServerStatus === "online" && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  <p>Quick links:</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {["google.com", "wikipedia.org", "github.com", "reddit.com"].map((site) => (
                      <Button
                        key={site}
                        variant="outline"
                        size="sm"
                        onClick={() => setUrl(site)}
                        disabled={bareServerStatus !== "online"}
                      >
                        {site}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Limitations
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Uses public CORS proxy - some sites may block access</p>
                <p>• JavaScript functionality is limited</p>
                <p>• Login forms and cookies won't persist</p>
                <p>• Some media content may not load</p>
                <p>• For full proxy support, consider self-hosting a Bare Server</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {/* URL Bar */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Go"
                )}
              </Button>
              <Button variant="outline" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </form>

            {/* Proxy Frame */}
            <Card className="flex-1 overflow-hidden">
              <iframe
                ref={iframeRef}
                src={proxyUrl}
                className="w-full h-full min-h-[70vh] border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title="Proxy Content"
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Proxy;
