import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, Users, Bot } from 'lucide-react';

type Player = 'X' | 'O' | null;
type Board = Player[];

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

const checkWinner = (board: Board): Player => {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
};

const isBoardFull = (board: Board): boolean => board.every(cell => cell !== null);

const getAIMove = (board: Board): number => {
  // Try to win
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    const cells = [board[a], board[b], board[c]];
    if (cells.filter(c => c === 'O').length === 2 && cells.includes(null)) {
      const emptyIndex = [a, b, c][cells.indexOf(null)];
      return emptyIndex;
    }
  }
  
  // Block player from winning
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    const cells = [board[a], board[b], board[c]];
    if (cells.filter(c => c === 'X').length === 2 && cells.includes(null)) {
      const emptyIndex = [a, b, c][cells.indexOf(null)];
      return emptyIndex;
    }
  }
  
  // Take center if available
  if (board[4] === null) return 4;
  
  // Take a corner
  const corners = [0, 2, 6, 8].filter(i => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
  
  // Take any available
  const available = board.map((c, i) => c === null ? i : -1).filter(i => i !== -1);
  return available[Math.floor(Math.random() * available.length)];
};

export function TicTacToe() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<Player>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [vsAI, setVsAI] = useState(true);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0 });

  useEffect(() => {
    const saved = localStorage.getItem('tictactoe-stats');
    if (saved) setStats(JSON.parse(saved));
  }, []);

  const saveStats = (newStats: typeof stats) => {
    setStats(newStats);
    localStorage.setItem('tictactoe-stats', JSON.stringify(newStats));
  };

  const saveScore = async () => {
    if (!user) return;
    await supabase.from('game_scores').insert({
      user_id: user.id,
      game_type: 'tictactoe',
      score: stats.wins + 1,
    });
  };

  useEffect(() => {
    if (vsAI && currentPlayer === 'O' && !winner && !isDraw) {
      const timer = setTimeout(() => {
        const aiMove = getAIMove(board);
        if (aiMove !== undefined) {
          makeMove(aiMove);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, vsAI, winner, isDraw, board]);

  const makeMove = (index: number) => {
    if (board[index] || winner || isDraw) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      if (gameWinner === 'X') {
        const newStats = { ...stats, wins: stats.wins + 1 };
        saveStats(newStats);
        saveScore();
        toast({ title: "🎉 You Won!", description: "Great job!" });
      } else {
        const newStats = { ...stats, losses: stats.losses + 1 };
        saveStats(newStats);
        toast({ title: "You Lost!", description: "Better luck next time!" });
      }
    } else if (isBoardFull(newBoard)) {
      setIsDraw(true);
      const newStats = { ...stats, draws: stats.draws + 1 };
      saveStats(newStats);
      toast({ title: "It's a Draw!", description: "Well played!" });
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const handleClick = (index: number) => {
    if (vsAI && currentPlayer === 'O') return;
    makeMove(index);
  };

  const restart = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setIsDraw(false);
  };

  const toggleMode = () => {
    setVsAI(!vsAI);
    restart();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-xs">
        <div className="flex gap-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Wins</p>
            <p className="text-lg font-bold text-green-500">{stats.wins}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Losses</p>
            <p className="text-lg font-bold text-red-500">{stats.losses}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Draws</p>
            <p className="text-lg font-bold text-yellow-500">{stats.draws}</p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={restart}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={toggleMode} className="gap-2">
        {vsAI ? <Bot className="w-4 h-4" /> : <Users className="w-4 h-4" />}
        {vsAI ? 'vs AI' : 'vs Friend'}
      </Button>

      <div className="bg-secondary/30 rounded-xl p-4">
        <div className="grid grid-cols-3 gap-2">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              disabled={!!cell || !!winner || isDraw}
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

      {!winner && !isDraw && (
        <p className="text-sm text-muted-foreground">
          {vsAI && currentPlayer === 'O' 
            ? "AI is thinking..." 
            : `${currentPlayer === 'X' ? 'Your' : "Player 2's"} turn (${currentPlayer})`
          }
        </p>
      )}

      {(winner || isDraw) && (
        <div className="text-center">
          <p className="text-lg font-bold text-foreground mb-2">
            {isDraw ? "It's a Draw!" : winner === 'X' ? 'You Won! 🎉' : 'AI Wins!'}
          </p>
          <Button onClick={restart} variant="hero" size="sm">Play Again</Button>
        </div>
      )}
    </div>
  );
}
