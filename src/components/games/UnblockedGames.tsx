import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UNBLOCKED_GAMES = [
  { id: 'slope', name: 'Slope', url: 'https://slope-game.github.io/', description: 'Fast-paced ball rolling' },
  { id: 'run3', name: 'Run 3', url: 'https://run3.io/', description: 'Endless runner in space' },
  { id: 'ovo', name: 'OvO', url: 'https://ovo.fandom.com/wiki/Play_OvO', description: 'Parkour platformer' },
];

export function UnblockedGames() {
  const launchGame = (url: string, gameName: string) => {
    const newTab = window.open('about:blank', '_blank');
    
    if (newTab) {
      const iframe = newTab.document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100vh';
      iframe.style.border = 'none';
      iframe.src = url;
      
      newTab.document.body.style.margin = '0';
      newTab.document.body.style.overflow = 'hidden';
      newTab.document.body.appendChild(iframe);
      newTab.document.title = gameName;
    } else {
      alert('Could not open new window. Please allow popups for this site.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <Rocket className="w-12 h-12 mx-auto mb-2 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Unblocked Games</h2>
        <p className="text-sm text-muted-foreground">Select a game to play</p>
      </div>
      
      <div className="space-y-3">
        {UNBLOCKED_GAMES.map((game) => (
          <Button
            key={game.id}
            onClick={() => launchGame(game.url, game.name)}
            variant="outline"
            className="w-full h-auto py-4 flex flex-col items-start gap-1 bg-secondary/30 hover:bg-primary/20 border-primary/30 hover:border-primary/50 transition-all"
          >
            <span className="font-bold text-foreground">{game.name}</span>
            <span className="text-xs text-muted-foreground">{game.description}</span>
          </Button>
        ))}
      </div>
      
      <p className="text-xs text-center text-muted-foreground mt-6">
        Games open in a new tab. Make sure popups are allowed.
      </p>
    </div>
  );
}
