import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, Users, Wifi, WifiOff, Copy, Check } from 'lucide-react';

type Player = 'X' | 'O' | '' | null;
type Board = Player[];

interface Game {
  id: string;
  player_x_id: string;
  player_o_id: string | null;
  board: Board;
  current_turn: 'X' | 'O';
  winner: string | null;
  status: 'waiting' | 'playing' | 'finished';
}

interface PlayerProfile {
  username: string;
  display_name: string | null;
}

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const checkWinner = (board: Board): Player => {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
};

const isBoardFull = (board: Board): boolean => board.every(cell => cell !== '' && cell !== null);

export function TicTacToeOnline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<Game | null>(null);
  const [waitingGames, setWaitingGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [playerX, setPlayerX] = useState<PlayerProfile | null>(null);
  const [playerO, setPlayerO] = useState<PlayerProfile | null>(null);
  const [copied, setCopied] = useState(false);

  const mySymbol = game ? (game.player_x_id === user?.id ? 'X' : 'O') : null;
  const isMyTurn = game?.status === 'playing' && game.current_turn === mySymbol;

  useEffect(() => {
    if (!game) {
      fetchWaitingGames();
    }
  }, [game]);

  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`game-${game.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tictactoe_games',
          filter: `id=eq.${game.id}`,
        },
        (payload) => {
          const newGame = payload.new as Game;
          setGame(newGame);
          
          if (newGame.winner || (isBoardFull(newGame.board) && !newGame.winner)) {
            if (newGame.winner === mySymbol) {
              toast({ title: "🎉 You Won!" });
            } else if (newGame.winner) {
              toast({ title: "You Lost!", variant: "destructive" });
            } else {
              toast({ title: "It's a Draw!" });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, mySymbol]);

  useEffect(() => {
    if (game?.player_x_id) fetchPlayerProfile(game.player_x_id, setPlayerX);
    if (game?.player_o_id) fetchPlayerProfile(game.player_o_id, setPlayerO);
  }, [game?.player_x_id, game?.player_o_id]);

  const fetchPlayerProfile = async (id: string, setter: (p: PlayerProfile | null) => void) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      setter({
        username: (data as any).username,
        display_name: (data as any).display_name,
      });
    }
  };

  const fetchWaitingGames = async () => {
    const { data } = await supabase
      .from('tictactoe_games' as any)
      .select('*')
      .eq('status', 'waiting')
      .neq('player_x_id', user?.id || '')
      .order('created_at', { ascending: false })
      .limit(10);
    
    setWaitingGames((data as unknown as Game[]) || []);
  };

  const createGame = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('tictactoe_games' as any)
      .insert({ player_x_id: user.id })
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: 'Failed to create game.', variant: 'destructive' });
    } else {
      setGame(data as unknown as Game);
      toast({ title: 'Game created!', description: 'Waiting for opponent...' });
    }
  };

  const joinGame = async (gameId: string) => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('tictactoe_games' as any)
      .update({ player_o_id: user.id, status: 'playing' })
      .eq('id', gameId)
      .eq('status', 'waiting')
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: 'Game no longer available.', variant: 'destructive' });
      fetchWaitingGames();
    } else {
      setGame(data as unknown as Game);
      toast({ title: 'Joined game!', description: "It's X's turn." });
    }
  };

  const makeMove = async (index: number) => {
    if (!game || !user || !isMyTurn || game.board[index]) return;

    const newBoard = [...game.board];
    newBoard[index] = mySymbol;

    const winner = checkWinner(newBoard);
    const isDraw = !winner && isBoardFull(newBoard);

    await supabase
      .from('tictactoe_games' as any)
      .update({
        board: newBoard,
        current_turn: mySymbol === 'X' ? 'O' : 'X',
        winner: winner || null,
        status: winner || isDraw ? 'finished' : 'playing',
      })
      .eq('id', game.id);
  };

  const leaveGame = async () => {
    if (!game) return;
    
    if (game.status === 'waiting' && game.player_x_id === user?.id) {
      await supabase.from('tictactoe_games' as any).delete().eq('id', game.id);
    }
    
    setGame(null);
    setPlayerX(null);
    setPlayerO(null);
  };

  const copyGameLink = () => {
    if (!game) return;
    navigator.clipboard.writeText(game.id);
    setCopied(true);
    toast({ title: 'Game ID copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const getPlayerName = (profile: PlayerProfile | null, fallback: string) => {
    return profile?.display_name || profile?.username || fallback;
  };

  if (!user) {
    return (
      <div className="text-center text-muted-foreground">
        <p>Sign in to play online</p>
      </div>
    );
  }

  // Lobby view
  if (!game) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-md mx-auto">
        <div className="text-center">
          <Wifi className="w-12 h-12 mx-auto mb-2 text-primary" />
          <h2 className="text-xl font-bold">Online Tic Tac Toe</h2>
          <p className="text-sm text-muted-foreground">Play against other users</p>
        </div>

        <Button onClick={createGame} disabled={loading} className="w-full gap-2">
          <Users className="w-4 h-4" />
          Create New Game
        </Button>

        {waitingGames.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-sm font-medium text-foreground">Join a Game:</p>
            {waitingGames.map((g) => (
              <Button
                key={g.id}
                variant="outline"
                onClick={() => joinGame(g.id)}
                disabled={loading}
                className="w-full justify-between"
              >
                <span>Game #{g.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">Waiting...</span>
              </Button>
            ))}
          </div>
        )}

        {waitingGames.length === 0 && (
          <p className="text-sm text-muted-foreground">No games available. Create one!</p>
        )}
      </div>
    );
  }

  // Game view
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Game status */}
      <div className="flex items-center justify-between w-full max-w-xs">
        <div className="flex items-center gap-2">
          {game.status === 'waiting' ? (
            <>
              <WifiOff className="w-4 h-4 text-yellow-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Waiting for opponent...</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">
                {isMyTurn ? 'Your turn' : "Opponent's turn"}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-1">
          {game.status === 'waiting' && (
            <Button variant="outline" size="icon" onClick={copyGameLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={leaveGame}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Players */}
      <div className="flex items-center gap-4 text-sm">
        <div className={`px-3 py-1 rounded-lg ${mySymbol === 'X' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
          X: {game.player_x_id === user.id ? 'You' : getPlayerName(playerX, 'Player X')}
        </div>
        <span className="text-muted-foreground">vs</span>
        <div className={`px-3 py-1 rounded-lg ${mySymbol === 'O' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
          O: {game.player_o_id === user.id ? 'You' : game.player_o_id ? getPlayerName(playerO, 'Player O') : '???'}
        </div>
      </div>

      {/* Board */}
      <div className="bg-secondary/30 rounded-xl p-4">
        <div className="grid grid-cols-3 gap-2">
          {game.board.map((cell, i) => (
            <button
              key={i}
              onClick={() => makeMove(i)}
              disabled={!isMyTurn || !!cell || game.status !== 'playing'}
              className={`w-20 h-20 rounded-lg text-4xl font-bold transition-all flex items-center justify-center
                ${cell ? 'bg-secondary' : 'bg-secondary/50 hover:bg-secondary/80'}
                ${cell === 'X' ? 'text-primary' : 'text-red-500'}
                disabled:cursor-not-allowed
              `}
            >
              {cell}
            </button>
          ))}
        </div>
      </div>

      {/* Game over */}
      {game.status === 'finished' && (
        <div className="text-center">
          <p className="text-lg font-bold text-foreground mb-2">
            {game.winner === mySymbol ? 'You Won! 🎉' : game.winner ? 'You Lost!' : "It's a Draw!"}
          </p>
          <Button onClick={leaveGame} variant="hero" size="sm">Play Again</Button>
        </div>
      )}
    </div>
  );
}
