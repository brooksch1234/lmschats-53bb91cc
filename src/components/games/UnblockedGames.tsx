import { Rocket, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UNBLOCKED_GAMES = [
  { id: 'roblox', name: 'Roblox', url: 'https://nowgg.fun/apps/a/19900/b.html', description: 'Play Roblox online', category: 'sandbox', useProxy: false },
  { id: 'slope', name: 'Slope', url: 'https://slope-online.github.io/', description: 'Fast-paced ball rolling', category: 'action' },
  { id: 'run3', name: 'Run 3', url: 'https://run3.io/', description: 'Endless runner in space', category: 'runner' },
  { id: 'ovo', name: 'OvO', url: 'https://ovo-game-online.github.io/', description: 'Parkour platformer', category: 'platformer' },
  { id: 'stickman', name: 'Stickman Hook', url: 'https://stickman-hook.github.io/', description: 'Swing through levels', category: 'action' },
  { id: 'doodle', name: 'Doodle Jump', url: 'https://doodlejump.io/', description: 'Jump to the top', category: 'arcade' },
  { id: 'basket', name: 'Basket Random', url: 'https://basketrandom.github.io/', description: 'Wacky basketball', category: 'sports' },
];

export function UnblockedGames() {
  const launchGame = (url: string, gameName: string, useProxy?: boolean) => {
    const newTab = window.open('about:blank', '_blank');
    
    const finalUrl = useProxy 
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      : url;
    
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
          <iframe src="${finalUrl}" allowfullscreen></iframe>
        </body>
        </html>
      `);
      newTab.document.close();
    } else {
      alert('Could not open new window. Please allow popups for this site.');
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
            onClick={() => launchGame(game.url, game.name, game.useProxy)}
            variant="outline"
            className="h-auto py-4 flex items-center gap-3 bg-secondary/30 hover:bg-primary/20 border-primary/30 hover:border-primary/50 transition-all group"
          >
            <Gamepad2 className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <span className="font-bold text-foreground block">{game.name}</span>
              <span className="text-xs text-muted-foreground">{game.description}</span>
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