import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Gamepad2, Medal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Game2048 } from '@/components/games/Game2048';
import { FlappyBird } from '@/components/games/FlappyBird';
import { SnakeGame } from '@/components/games/SnakeGame';
import { TicTacToe } from '@/components/games/TicTacToe';
import { WordleGame } from '@/components/games/WordleGame';

interface LeaderboardEntry {
  username: string;
  score: number;
  created_at: string;
}

const GAMES = [
  { id: '2048', name: '2048', component: Game2048 },
  { id: 'flappy', name: 'Flappy', component: FlappyBird },
  { id: 'snake', name: 'Snake', component: SnakeGame },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', component: TicTacToe },
  { id: 'wordle', name: 'Wordle', component: WordleGame },
];

export default function Games() {
  const [activeGame, setActiveGame] = useState('2048');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    fetchLeaderboard(activeGame);
  }, [activeGame]);

  const fetchLeaderboard = async (gameType: string) => {
    setLoadingLeaderboard(true);
    const { data } = await supabase
      .from('game_scores')
      .select('score, created_at, user_id')
      .eq('game_type', gameType)
      .order('score', { ascending: false })
      .limit(10);

    if (data) {
      const withUsernames = await Promise.all(
        data.map(async (entry) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', entry.user_id)
            .maybeSingle();
          return {
            username: profile?.username || 'Unknown',
            score: entry.score,
            created_at: entry.created_at,
          };
        })
      );
      setLeaderboard(withUsernames);
    }
    setLoadingLeaderboard(false);
  };

  const ActiveGameComponent = GAMES.find(g => g.id === activeGame)?.component || Game2048;

  return (
    <div className="min-h-screen gradient-bg">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/chats">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Games</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Game Area */}
          <div className="lg:col-span-2">
            <Tabs value={activeGame} onValueChange={setActiveGame}>
              <TabsList className="grid grid-cols-5 mb-6">
                {GAMES.map(game => (
                  <TabsTrigger key={game.id} value={game.id} className="text-xs px-2">
                    {game.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {GAMES.map(game => (
                <TabsContent key={game.id} value={game.id} className="flex justify-center">
                  <div className="glass-card rounded-2xl p-6">
                    <game.component />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Leaderboard */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="font-semibold text-foreground">Leaderboard</h2>
            </div>
            
            <ScrollArea className="h-96">
              {loadingLeaderboard ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-secondary/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Medal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No scores yet!</p>
                  <p className="text-sm">Be the first to play</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        i === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' :
                        i === 1 ? 'bg-gray-400/10 border border-gray-400/30' :
                        i === 2 ? 'bg-orange-600/10 border border-orange-600/30' :
                        'bg-secondary/30'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-yellow-500 text-yellow-950' :
                        i === 1 ? 'bg-gray-400 text-gray-950' :
                        i === 2 ? 'bg-orange-600 text-white' :
                        'bg-secondary text-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{entry.username}</p>
                      </div>
                      <p className="font-bold text-primary">{entry.score.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
}