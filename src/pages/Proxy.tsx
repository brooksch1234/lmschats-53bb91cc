import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, Loader2, ExternalLink, RefreshCw, Home, AlertTriangle, X, Wifi, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Wisp/Bare Server endpoints - updated list with alternatives that may bypass filters
const PROXY_SERVERS = [
  { url: "wss://aluu.xyz/wisp/", name: "Aluu", type: "wisp" },
  { url: "wss://ruby.rubynetwork.co/wisp/", name: "Ruby", type: "wisp" },
  { url: "wss://nebulaproxy.io/wisp/", name: "Nebula", type: "wisp" },
  { url: "wss://uv.holyubofficial.net/wisp/", name: "Holy", type: "wisp" },
  { url: "https://uv.holyubofficial.net/bare/", name: "Holy Bare", type: "bare" },
  { url: "https://tomp.app/bare/", name: "TOMP", type: "bare" },
];

// Alternative CORS proxies that might bypass Cisco Umbrella
const CORS_PROXIES = [
  { url: "https://api.allorigins.win/raw?url=", name: "AllOrigins" },
  { url: "https://corsproxy.io/?", name: "CORSProxy.io" },
  { url: "https://api.codetabs.com/v1/proxy?quest=", name: "CodeTabs" },
];

const Proxy = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [activeServer, setActiveServer] = useState<{ url: string; name: string; type: string } | null>(null);
  const [activeCorsProxy, setActiveCorsProxy] = useState<{ url: string; name: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check server availability on mount
  useEffect(() => {
    checkServers();
  }, []);

  const checkServers = async () => {
    setServerStatus("checking");
    setActiveServer(null);
    setActiveCorsProxy(null);
    
    // Check CORS proxies first (they're more reliable for basic browsing)
    for (const proxy of CORS_PROXIES) {
      try {
        const testUrl = `${proxy.url}${encodeURIComponent("https://httpbin.org/get")}`;
        const response = await fetch(testUrl, { 
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          setActiveCorsProxy(proxy);
          console.log("Connected to CORS proxy:", proxy.name);
          break;
        }
      } catch (err) {
        console.log(`CORS proxy ${proxy.name} unavailable:`, err);
      }
    }

    // Check Wisp/Bare servers
    for (const server of PROXY_SERVERS) {
      try {
        if (server.type === "wisp") {
          // For WebSocket servers, we can try to establish a brief connection
          const ws = new WebSocket(server.url);
          const connected = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
              ws.close();
              resolve(false);
            }, 3000);
            
            ws.onopen = () => {
              clearTimeout(timeout);
              ws.close();
              resolve(true);
            };
            ws.onerror = () => {
              clearTimeout(timeout);
              resolve(false);
            };
          });
          
          if (connected) {
            setActiveServer(server);
            setServerStatus("online");
            console.log("Connected to Wisp server:", server.name);
            return;
          }
        } else {
          // For Bare servers, use HTTP
          const response = await fetch(server.url, { 
            method: "GET",
            mode: "cors",
            signal: AbortSignal.timeout(3000),
          });
          if (response.ok) {
            setActiveServer(server);
            setServerStatus("online");
            console.log("Connected to Bare server:", server.name);
            return;
          }
        }
      } catch (err) {
        console.log(`Server ${server.name} unavailable:`, err);
      }
    }
    
    // If we have at least a CORS proxy, we're partially online
    if (activeCorsProxy) {
      setServerStatus("online");
    } else {
      setServerStatus("offline");
      setError("No proxy servers available. They may be blocked by your network.");
    }
  };

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    return normalized;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    if (serverStatus !== "online") {
      toast.error("No proxy servers available");
      return;
    }

    setIsLoading(true);
    setError(null);

    const normalizedUrl = normalizeUrl(url);

    try {
      // Use the active CORS proxy
      if (activeCorsProxy) {
        const encodedUrl = encodeURIComponent(normalizedUrl);
        const corsProxyUrl = `${activeCorsProxy.url}${encodedUrl}`;
        setProxyUrl(corsProxyUrl);
        toast.success(`Loading via ${activeCorsProxy.name}...`);
      } else {
        throw new Error("No proxy available");
      }
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

  const tryCorsProxy = async (proxyName: string) => {
    const proxy = CORS_PROXIES.find(p => p.name === proxyName);
    if (proxy && url) {
      const normalizedUrl = normalizeUrl(url);
      const encodedUrl = encodeURIComponent(normalizedUrl);
      setProxyUrl(`${proxy.url}${encodedUrl}`);
      setActiveCorsProxy(proxy);
      toast.success(`Trying ${proxy.name}...`);
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

          {/* Server Status */}
          <div className="ml-2 flex items-center gap-2">
            {serverStatus === "online" ? (
              <Wifi className="h-4 w-4 text-primary" />
            ) : serverStatus === "checking" ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {serverStatus === "online" && activeServer 
                ? `${activeServer.name} (${activeServer.type})`
                : serverStatus === "online" && activeCorsProxy
                ? `${activeCorsProxy.name}`
                : serverStatus === "checking" 
                ? "Checking..." 
                : "Offline"}
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
                  Browse websites through multiple proxy servers. Some may bypass network filters.
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
                      disabled={isLoading || serverStatus !== "online"}
                    />
                    <Button 
                      type="submit" 
                      disabled={isLoading || serverStatus !== "online"}
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

                {/* Server Status Cards */}
                <div className="mt-6 space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Available Proxies:</p>
                  <div className="flex flex-wrap gap-2">
                    {CORS_PROXIES.map((proxy) => (
                      <Badge 
                        key={proxy.name}
                        variant={activeCorsProxy?.name === proxy.name ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setActiveCorsProxy(proxy);
                          toast.success(`Switched to ${proxy.name}`);
                        }}
                      >
                        {proxy.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {serverStatus === "offline" && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-destructive font-medium">All Proxies Blocked</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your network may be blocking proxy services. Try{" "}
                        <button 
                          onClick={checkServers}
                          className="text-primary underline"
                        >
                          retrying
                        </button>{" "}
                        or use a VPN.
                      </p>
                    </div>
                  </div>
                )}

                {error && serverStatus === "online" && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  <p>Quick links:</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {["google.com", "wikipedia.org", "github.com", "duckduckgo.com", "bing.com"].map((site) => (
                      <Button
                        key={site}
                        variant="outline"
                        size="sm"
                        onClick={() => setUrl(site)}
                        disabled={serverStatus !== "online"}
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
                  <AlertTriangle className="h-5 w-5 text-accent" />
                  Tips for Bypassing Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Try different proxy servers above - some may not be blocked</p>
                <p>• If a site doesn't load, try clicking a different proxy badge</p>
                <p>• JavaScript-heavy sites may have limited functionality</p>
                <p>• Login sessions won't persist between visits</p>
                <p>• For better reliability, consider using a VPN service</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {/* URL Bar */}
            <div className="flex gap-2 items-center">
              <form onSubmit={handleSubmit} className="flex gap-2 flex-1">
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
              
              {/* Quick proxy switch */}
              <div className="flex gap-1">
                {CORS_PROXIES.map((proxy) => (
                  <Button
                    key={proxy.name}
                    variant={activeCorsProxy?.name === proxy.name ? "default" : "ghost"}
                    size="sm"
                    onClick={() => tryCorsProxy(proxy.name)}
                    title={`Try ${proxy.name}`}
                  >
                    {proxy.name.slice(0, 2)}
                  </Button>
                ))}
              </div>
            </div>

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
