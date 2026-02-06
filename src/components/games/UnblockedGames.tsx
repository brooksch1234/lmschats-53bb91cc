import { Rocket, Gamepad2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

const SUPABASE_URL = "https://pvqvqeehokvcplrjenfr.supabase.co";

const UNBLOCKED_GAMES = [
  { id: 'roblox', name: 'Roblox', url: 'https://nowgg.fun/apps/a/19900/b.html', description: 'Play Roblox online', category: 'sandbox', useProxy: true },
  { id: 'slope', name: 'Slope', url: 'https://slope-online.github.io/', description: 'Fast-paced ball rolling', category: 'action', useProxy: true },
  { id: 'run3', name: 'Run 3', url: 'https://run3.io/', description: 'Endless runner in space', category: 'runner', useProxy: true },
  { id: 'ovo', name: 'OvO', url: 'https://ovo-game-online.github.io/', description: 'Parkour platformer', category: 'platformer', useProxy: true },
  { id: 'stickman', name: 'Stickman Hook', url: 'https://stickman-hook.github.io/', description: 'Swing through levels', category: 'action', useProxy: true },
  { id: 'doodle', name: 'Doodle Jump', url: 'https://doodlejump.io/', description: 'Jump to the top', category: 'arcade', useProxy: true },
  { id: 'basket', name: 'Basket Random', url: 'https://basketrandom.github.io/', description: 'Wacky basketball', category: 'sports', useProxy: true },
];

export function UnblockedGames() {
  const [loadingGame, setLoadingGame] = useState<string | null>(null);

  const launchGame = async (url: string, gameName: string, gameId: string, useProxy?: boolean) => {
    // For Roblox, use the CORS proxy directly without modifying internal links
    if (gameId === 'roblox') {
      const corsProxyUrl = `https://corsproxy.io/?key=1ef8a08d&url=${encodeURIComponent(url)}`;
      const newTab = window.open('about:blank', '_blank');
      if (newTab) {
        newTab.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${gameName}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { overflow: hidden; background: #000; }
              iframe { width: 100vw; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${corsProxyUrl}" allowfullscreen></iframe>
          </body>
          </html>
        `);
        newTab.document.close();
      } else {
        toast.error('Please allow popups for this site');
      }
      return;
    }

    if (useProxy) {
      setLoadingGame(gameId);
      try {
        // Fetch the page through our proxy
        const response = await fetch(`${SUPABASE_URL}/functions/v1/web-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, raw: true }),
        });

        if (!response.ok) {
          throw new Error('Failed to load game');
        }

        const html = await response.text();
        
        // Open new tab and write the proxied content
        const newTab = window.open('about:blank', '_blank');
        if (newTab) {
          newTab.document.open();
          newTab.document.write(html);
          newTab.document.close();
        } else {
          toast.error('Please allow popups for this site');
        }
      } catch (error) {
        console.error('Failed to load game:', error);
        toast.error('Failed to load game. Try again or play without proxy.');
        
        // Fallback: try direct URL
        window.open(url, '_blank');
      } finally {
        setLoadingGame(null);
      }
    } else {
      // Direct launch without proxy
      const newTab = window.open('about:blank', '_blank');
      if (newTab) {
        newTab.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${gameName}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { overflow: hidden; background: #000; }
              iframe { width: 100vw; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${url}" allowfullscreen></iframe>
          </body>
          </html>
        `);
        newTab.document.close();
      } else {
        toast.error('Please allow popups for this site');
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <Rocket className="w-12 h-12 mx-auto mb-2 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Unblocked Games</h2>
        <p className="text-sm text-muted-foreground">Select a game to play in a new tab</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {UNBLOCKED_GAMES.map((game) => (
          <Button
            key={game.id}
            onClick={() => launchGame(game.url, game.name, game.id, game.useProxy)}
            variant="outline"
            disabled={loadingGame === game.id}
            className="h-auto py-4 flex items-center gap-3 bg-secondary/30 hover:bg-primary/20 border-primary/30 hover:border-primary/50 transition-all group"
          >
            {loadingGame === game.id ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Gamepad2 className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
            )}
            <div className="text-left">
              <span className="font-bold text-foreground block">{game.name}</span>
              <span className="text-xs text-muted-foreground">
                {loadingGame === game.id ? 'Loading...' : game.description}
              </span>
            </div>
          </Button>
        ))}
      </div>
      
      <p className="text-xs text-center text-muted-foreground mt-6">
        Games open in a new tab. Make sure popups are allowed.
      </p>
    </div>
  );
}
