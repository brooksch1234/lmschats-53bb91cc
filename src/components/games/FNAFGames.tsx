import { Ghost } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FNAF_GAMES = [
  { id: 'fnaf1', name: 'FNAF 1', url: 'https://irv77.github.io/hd_fnaf/1/', description: 'The original nightmare' },
  { id: 'fnaf2', name: 'FNAF 2', url: 'https://irv77.github.io/hd_fnaf/2/', description: 'More animatronics, more terror' },
  { id: 'fnaf3', name: 'FNAF 3', url: 'https://irv77.github.io/hd_fnaf/3/', description: 'Springtrap awaits' },
  { id: 'fnaf4', name: 'FNAF 4', url: 'https://irv77.github.io/hd_fnaf/4/', description: 'The final chapter' },
  { id: 'fnafsl', name: 'FNAF SL', url: 'https://irv77.github.io/hd_fnaf/sl/', description: 'Sister Location' },
];

export function FNAFGames() {
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
        <Ghost className="w-12 h-12 mx-auto mb-2 text-purple-500" />
        <h2 className="text-xl font-bold text-foreground">Five Nights at Freddy's</h2>
        <p className="text-sm text-muted-foreground">Select a game to play</p>
      </div>
      
      <div className="space-y-3">
        {FNAF_GAMES.map((game) => (
          <Button
            key={game.id}
            onClick={() => launchGame(game.url, game.name)}
            variant="outline"
            className="w-full h-auto py-4 flex flex-col items-start gap-1 bg-secondary/30 hover:bg-purple-500/20 border-purple-500/30 hover:border-purple-500/50 transition-all"
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
