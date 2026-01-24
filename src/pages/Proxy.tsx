import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, Loader2, ExternalLink, RefreshCw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Proxy = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [proxyContent, setProxyContent] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    setIsLoading(true);
    setError(null);
    setProxyContent(null);

    const normalizedUrl = normalizeUrl(url);

    try {
      const { data, error } = await supabase.functions.invoke("web-proxy", {
        body: { url: normalizedUrl },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setProxyContent(data.content);
      setCurrentUrl(normalizedUrl);
      toast.success("Page loaded successfully");
    } catch (err: any) {
      console.error("Proxy error:", err);
      setError(err.message || "Failed to load page");
      toast.error("Failed to load page");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (currentUrl) {
      setUrl(currentUrl);
      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    }
  };

  const handleClear = () => {
    setProxyContent(null);
    setCurrentUrl(null);
    setUrl("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background">
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

          {proxyContent && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleClear}>
                <Home className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {!proxyContent ? (
          <div className="max-w-2xl mx-auto">
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
                      disabled={isLoading}
                    />
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      <span className="ml-2">Go</span>
                    </Button>
                  </div>
                </form>

                {error && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  <p>Quick links:</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {["google.com", "wikipedia.org", "github.com"].map((site) => (
                      <Button
                        key={site}
                        variant="outline"
                        size="sm"
                        onClick={() => setUrl(site)}
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
                <CardTitle className="text-lg">⚠️ Limitations</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• This is a simple proxy and may not work with all websites</p>
                <p>• JavaScript-heavy sites may not function properly</p>
                <p>• Some sites block proxy requests</p>
                <p>• Login forms and authentication won't work</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
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
            </form>

            {/* Proxy Frame */}
            <Card className="overflow-hidden">
              <div
                className="w-full min-h-[70vh] bg-white"
                dangerouslySetInnerHTML={{ __html: proxyContent }}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Proxy;
