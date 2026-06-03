import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChatGame {
  id: string;
  connection_id: string;
  game_type: 'tictactoe' | 'rps';
  player1_id: string;
  player2_id: string;
  state: any;
  current_turn: string | null;
  status: 'pending' | 'active' | 'finished';
  winner_id: string | null;
}

const TTT_WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const checkTTTWinner = (b: string[]) => {
  for (const [a,c,d] of TTT_WINS) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(x => x) ? 'draw' : null;
};

const beats: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export function ChatGameDialog({
  gameId, open, onOpenChange,
}: { gameId: string; open: boolean; onOpenChange: (v: boolean) => void; }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<ChatGame | null>(null);
  const [opponentName, setOpponentName] = useState('');

  useEffect(() => {
    if (!open || !gameId) return;
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.from('chat_games').select('*').eq('id', gameId).maybeSingle();
      if (mounted && data) {
        setGame(data as any);
        const otherId = data.player1_id === user?.id ? data.player2_id : data.player1_id;
        const { data: p } = await supabase.from('profiles').select('username').eq('id', otherId).maybeSingle();
        if (mounted) setOpponentName(p?.username || 'Friend');
      }
    };
    load();

    const channel = supabase
      .channel(`chat_game-${gameId}-${user?.id}-${Date.now()}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_games', filter: `id=eq.${gameId}` },
        (payload) => { if (mounted) setGame(payload.new as any); }
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [gameId, open, user?.id]);

  if (!game || !user) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><div className="py-8 text-center text-muted-foreground">Loading game…</div></DialogContent>
    </Dialog>
  );

  const isPlayer = game.player1_id === user.id || game.player2_id === user.id;
  if (!isPlayer) return null;

  const acceptInvite = async () => {
    await supabase.from('chat_games').update({ status: 'active' }).eq('id', game.id);
  };

  // ===== TIC-TAC-TOE =====
  const renderTTT = () => {
    const board: string[] = game.state.board || Array(9).fill('');
    const mySymbol = game.player1_id === user.id ? 'X' : 'O';
    const isMyTurn = game.status === 'active' && game.current_turn === user.id;
    const winnerSymbol = checkTTTWinner(board);

    const makeMove = async (idx: number) => {
      if (!isMyTurn || board[idx] || game.status !== 'active') return;
      const next = [...board];
      next[idx] = mySymbol;
      const w = checkTTTWinner(next);
      const otherId = game.player1_id === user.id ? game.player2_id : game.player1_id;
      await supabase.from('chat_games').update({
        state: { board: next },
        current_turn: w ? null : otherId,
        status: w ? 'finished' : 'active',
        winner_id: w === 'draw' ? null : w ? user.id : null,
      }).eq('id', game.id);
    };

    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          {game.status === 'pending' ? 'Waiting for opponent to accept…' :
           game.status === 'finished'
             ? game.winner_id === user.id ? '🎉 You won!' : game.winner_id ? `${opponentName} won` : "It's a draw"
             : isMyTurn ? "Your turn" : `Waiting for ${opponentName}…`}
        </p>
        <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => makeMove(i)}
              disabled={!isMyTurn || !!cell || game.status !== 'active'}
              className="aspect-square rounded-xl bg-secondary/60 hover:bg-secondary border border-border/60 text-3xl font-display font-bold text-foreground disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {cell === 'X' && <span className="text-primary">X</span>}
              {cell === 'O' && <span className="text-emerald-400">O</span>}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">You're <span className="text-foreground font-bold">{mySymbol}</span></p>
      </div>
    );
  };

  // ===== ROCK PAPER SCISSORS =====
  const renderRPS = () => {
    const picks: Record<string, string> = game.state.picks || {};
    const myPick = picks[user.id];
    const otherId = game.player1_id === user.id ? game.player2_id : game.player1_id;
    const theirPick = picks[otherId];
    const round = game.state.round || 1;
    const scores: Record<string, number> = game.state.scores || { [game.player1_id]: 0, [game.player2_id]: 0 };

    const choose = async (choice: 'rock' | 'paper' | 'scissors') => {
      if (myPick || game.status !== 'active') return;
      const newPicks = { ...picks, [user.id]: choice };
      // If both have picked, resolve round
      if (newPicks[otherId]) {
        const a = newPicks[user.id]; const b = newPicks[otherId];
        let newScores = { ...scores };
        if (a !== b) {
          const winnerId = beats[a] === b ? user.id : otherId;
          newScores[winnerId] = (newScores[winnerId] || 0) + 1;
        }
        const finished = newScores[user.id] >= 3 || newScores[otherId] >= 3;
        await supabase.from('chat_games').update({
          state: { picks: newPicks, round, scores: newScores, lastRound: { [user.id]: a, [otherId]: b } },
          status: finished ? 'finished' : 'active',
          winner_id: finished ? (newScores[user.id] >= 3 ? user.id : otherId) : null,
        }).eq('id', game.id);
      } else {
        await supabase.from('chat_games').update({ state: { ...game.state, picks: newPicks } }).eq('id', game.id);
      }
    };

    const nextRound = async () => {
      await supabase.from('chat_games').update({
        state: { ...game.state, picks: {}, round: round + 1 },
      }).eq('id', game.id);
    };

    const bothPicked = myPick && theirPick;
    const last = game.state.lastRound;

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-around text-center">
          <div>
            <div className="text-xs text-muted-foreground mb-1">You</div>
            <div className="text-2xl font-display font-bold text-primary">{scores[user.id] || 0}</div>
          </div>
          <div className="text-xs text-muted-foreground font-mono">first to 3</div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{opponentName}</div>
            <div className="text-2xl font-display font-bold text-emerald-400">{scores[otherId] || 0}</div>
          </div>
        </div>

        {game.status === 'finished' ? (
          <p className="text-center text-base font-display font-bold">
            {game.winner_id === user.id ? '🏆 You won the match!' : `${opponentName} won the match`}
          </p>
        ) : bothPicked && last ? (
          <div className="text-center space-y-3">
            <div className="flex justify-around text-4xl">
              <span>{emoji(last[user.id])}</span>
              <span className="text-muted-foreground text-sm self-center">vs</span>
              <span>{emoji(last[otherId])}</span>
            </div>
            <Button onClick={nextRound} size="sm" variant="outline" className="gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Next round
            </Button>
          </div>
        ) : myPick ? (
          <p className="text-center text-sm text-muted-foreground">You picked {emoji(myPick)} · waiting for {opponentName}…</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {(['rock','paper','scissors'] as const).map(c => (
              <button
                key={c}
                onClick={() => choose(c)}
                disabled={game.status !== 'active'}
                className="aspect-square rounded-2xl bg-secondary/60 hover:bg-secondary border border-border/60 text-5xl flex items-center justify-center hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {emoji(c)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {game.game_type === 'tictactoe' ? 'Tic-Tac-Toe' : 'Rock · Paper · Scissors'}
          </DialogTitle>
        </DialogHeader>

        {game.status === 'pending' && game.player2_id === user.id && (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">{opponentName} challenged you to a game.</p>
            <Button onClick={acceptInvite} variant="hero" className="w-full">Accept challenge</Button>
          </div>
        )}

        {(game.status !== 'pending' || game.player1_id === user.id) && (
          game.game_type === 'tictactoe' ? renderTTT() : renderRPS()
        )}
      </DialogContent>
    </Dialog>
  );
}

function emoji(c: string) {
  return c === 'rock' ? '✊' : c === 'paper' ? '✋' : c === 'scissors' ? '✌️' : '?';
}
