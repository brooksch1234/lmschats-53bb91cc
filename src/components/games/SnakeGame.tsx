import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, RotateCcw } from 'lucide-react';

const GRID_SIZE = 20;
const CELL_SIZE = 16;
const INITIAL_SPEED = 150;

type Direction = 'up' | 'down' | 'left' | 'right';
type Position = { x: number; y: number };

export function SnakeGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('right');
  
  const directionRef = useRef<Direction>('right');
  const gameLoopRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const saved = localStorage.getItem('snake-best');
    if (saved) setBestScore(parseInt(saved));
  }, []);

  const saveScore = async (finalScore: number) => {
    if (!user || finalScore <= 0) return;
    await supabase.from('game_scores').insert({
      user_id: user.id,
      game_type: 'snake',
      score: finalScore,
    });
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem('snake-best', finalScore.toString());
    }
  };

  const generateFood = useCallback((snakeBody: Position[]): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (snakeBody.some(s => s.x === newFood.x && s.y === newFood.y));
    return newFood;
  }, []);

  const startGame = () => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(generateFood(initialSnake));
    setDirection('right');
    directionRef.current = 'right';
    setScore(0);
    setGameState('playing');
  };

  const gameOver = useCallback((finalScore: number) => {
    setGameState('gameover');
    saveScore(finalScore);
    toast({ title: "Game Over!", description: `Score: ${finalScore}` });
  }, [toast]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const moveSnake = () => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        
        switch (directionRef.current) {
          case 'up': head.y--; break;
          case 'down': head.y++; break;
          case 'left': head.x--; break;
          case 'right': head.x++; break;
        }

        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          gameOver(score);
          return prevSnake;
        }

        // Self collision
        if (prevSnake.some(s => s.x === head.x && s.y === head.y)) {
          gameOver(score);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Food collision
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 10);
          setFood(generateFood(newSnake));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    gameLoopRef.current = setInterval(moveSnake, INITIAL_SPEED - Math.min(score, 100));
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [gameState, food, generateFood, gameOver, score]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      };
      
      const newDir = keyMap[e.key];
      if (!newDir) return;
      
      e.preventDefault();
      
      const opposites: Record<Direction, Direction> = {
        up: 'down', down: 'up', left: 'right', right: 'left',
      };
      
      if (opposites[newDir] !== directionRef.current) {
        directionRef.current = newDir;
        setDirection(newDir);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        <Button variant="outline" size="icon" onClick={startGame}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div 
        className="relative bg-secondary/30 rounded-xl border border-border/50"
        style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}
      >
        {/* Snake */}
        {snake.map((segment, i) => (
          <div
            key={i}
            className={`absolute rounded-sm transition-all duration-75 ${
              i === 0 ? 'bg-primary' : 'bg-primary/70'
            }`}
            style={{
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              width: CELL_SIZE - 1,
              height: CELL_SIZE - 1,
            }}
          />
        ))}
        
        {/* Food */}
        <div
          className="absolute bg-red-500 rounded-full animate-pulse"
          style={{
            left: food.x * CELL_SIZE + 2,
            top: food.y * CELL_SIZE + 2,
            width: CELL_SIZE - 4,
            height: CELL_SIZE - 4,
          }}
        />

        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-xl">
            <Button onClick={startGame} variant="hero" size="lg" className="gap-2">
              <Play className="w-5 h-5" /> Start Game
            </Button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground mb-2">Game Over!</p>
              <p className="text-muted-foreground mb-4">Score: {score}</p>
              <Button onClick={startGame} variant="hero">Play Again</Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Use arrow keys or WASD to move</p>
    </div>
  );
}