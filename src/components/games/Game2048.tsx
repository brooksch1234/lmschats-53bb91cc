import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, Trophy } from 'lucide-react';

const GRID_SIZE = 4;
const WINNING_TILE = 2048;

type Grid = (number | null)[][];

const createEmptyGrid = (): Grid => 
  Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

const addRandomTile = (grid: Grid): Grid => {
  const empty: [number, number][] = [];
  grid.forEach((row, i) => row.forEach((cell, j) => { if (!cell) empty.push([i, j]); }));
  if (empty.length === 0) return grid;
  const [i, j] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[i][j] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
};

const rotateGrid = (grid: Grid): Grid => 
  grid[0].map((_, i) => grid.map(row => row[i]).reverse());

const slideRow = (row: (number | null)[]): { row: (number | null)[]; score: number } => {
  const filtered = row.filter(x => x !== null) as number[];
  let score = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      score += filtered[i];
      filtered.splice(i + 1, 1);
    }
  }
  while (filtered.length < GRID_SIZE) filtered.push(null as any);
  return { row: filtered, score };
};

const move = (grid: Grid, direction: 'left' | 'right' | 'up' | 'down'): { grid: Grid; score: number; moved: boolean } => {
  let rotations = { left: 0, up: 1, right: 2, down: 3 }[direction];
  let rotated = grid;
  for (let i = 0; i < rotations; i++) rotated = rotateGrid(rotated);
  
  let totalScore = 0;
  const slid = rotated.map(row => {
    const { row: newRow, score } = slideRow(row);
    totalScore += score;
    return newRow;
  });
  
  for (let i = 0; i < (4 - rotations) % 4; i++) slid.forEach((_, i, arr) => arr[i] = rotateGrid(slid)[i] || arr[i]);
  let result = slid;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotateGrid(result);
  
  const moved = JSON.stringify(grid) !== JSON.stringify(result);
  return { grid: result, score: totalScore, moved };
};

const isGameOver = (grid: Grid): boolean => {
  for (const dir of ['left', 'right', 'up', 'down'] as const) {
    if (move(grid, dir).moved) return false;
  }
  return true;
};

const hasWon = (grid: Grid): boolean => 
  grid.some(row => row.some(cell => cell === WINNING_TILE));

const getTileColor = (value: number | null): string => {
  const colors: Record<number, string> = {
    2: 'bg-amber-100 text-amber-900',
    4: 'bg-amber-200 text-amber-900',
    8: 'bg-orange-300 text-white',
    16: 'bg-orange-400 text-white',
    32: 'bg-orange-500 text-white',
    64: 'bg-red-400 text-white',
    128: 'bg-yellow-300 text-yellow-900',
    256: 'bg-yellow-400 text-yellow-900',
    512: 'bg-yellow-500 text-white',
    1024: 'bg-yellow-600 text-white',
    2048: 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/50',
  };
  return colors[value || 0] || 'bg-secondary/30';
};

export function Game2048() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [grid, setGrid] = useState<Grid>(() => addRandomTile(addRandomTile(createEmptyGrid())));
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('2048-best');
    if (saved) setBestScore(parseInt(saved));
  }, []);

  const saveScore = async (finalScore: number) => {
    if (!user || finalScore <= 0) return;
    await supabase.from('game_scores').insert({
      user_id: user.id,
      game_type: '2048',
      score: finalScore,
    });
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem('2048-best', finalScore.toString());
    }
  };

  const handleMove = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (gameOver) return;
    
    const result = move(grid, direction);
    if (!result.moved) return;
    
    const newGrid = addRandomTile(result.grid);
    const newScore = score + result.score;
    
    setGrid(newGrid);
    setScore(newScore);
    
    if (hasWon(newGrid) && !won) {
      setWon(true);
      toast({ title: "🎉 You Won!", description: "You reached 2048!" });
    }
    
    if (isGameOver(newGrid)) {
      setGameOver(true);
      saveScore(newScore);
      toast({ title: "Game Over!", description: `Final score: ${newScore}` });
    }
  }, [grid, score, gameOver, won]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down',
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        handleMove(keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove]);

  const restart = () => {
    setGrid(addRandomTile(addRandomTile(createEmptyGrid())));
    setScore(0);
    setGameOver(false);
    setWon(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-xs">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-2xl font-bold text-foreground">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Best</p>
          <p className="text-2xl font-bold text-primary">{bestScore}</p>
        </div>
        <Button variant="outline" size="icon" onClick={restart}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-secondary/50 rounded-xl p-3 relative">
        <div className="grid grid-cols-4 gap-2">
          {grid.flat().map((value, i) => (
            <div
              key={i}
              className={`w-16 h-16 rounded-lg flex items-center justify-center font-bold text-lg transition-all ${getTileColor(value)}`}
            >
              {value || ''}
            </div>
          ))}
        </div>
        
        {gameOver && (
          <div className="absolute inset-0 bg-background/80 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground mb-2">Game Over!</p>
              <Button onClick={restart} variant="hero">Play Again</Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Use arrow keys or WASD to play</p>
    </div>
  );
}