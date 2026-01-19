import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 480;
const BIRD_SIZE = 24;
const PIPE_WIDTH = 52;
const PIPE_GAP = 140;
const GRAVITY = 0.4;
const JUMP_FORCE = -7;

interface Bird {
  y: number;
  velocity: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

export function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  
  const birdRef = useRef<Bird>({ y: CANVAS_HEIGHT / 2, velocity: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const saved = localStorage.getItem('flappy-best');
    if (saved) setBestScore(parseInt(saved));
  }, []);

  const saveScore = async (finalScore: number) => {
    if (!user || finalScore <= 0) return;
    await supabase.from('game_scores').insert({
      user_id: user.id,
      game_type: 'flappy',
      score: finalScore,
    });
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem('flappy-best', finalScore.toString());
    }
  };

  const jump = useCallback(() => {
    if (gameState === 'idle') {
      setGameState('playing');
      birdRef.current = { y: CANVAS_HEIGHT / 2, velocity: JUMP_FORCE };
      pipesRef.current = [];
      scoreRef.current = 0;
      setScore(0);
    } else if (gameState === 'playing') {
      birdRef.current.velocity = JUMP_FORCE;
    }
  }, [gameState]);

  const restart = () => {
    setGameState('idle');
    birdRef.current = { y: CANVAS_HEIGHT / 2, velocity: 0 };
    pipesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const gameLoop = () => {
      // Clear
      ctx.fillStyle = 'hsl(200, 80%, 70%)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Ground
      ctx.fillStyle = 'hsl(120, 40%, 40%)';
      ctx.fillRect(0, CANVAS_HEIGHT - 40, CANVAS_WIDTH, 40);

      if (gameState === 'playing') {
        // Update bird
        birdRef.current.velocity += GRAVITY;
        birdRef.current.y += birdRef.current.velocity;

        // Add pipes
        if (pipesRef.current.length === 0 || pipesRef.current[pipesRef.current.length - 1].x < CANVAS_WIDTH - 200) {
          const topHeight = 50 + Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 140);
          pipesRef.current.push({ x: CANVAS_WIDTH, topHeight, passed: false });
        }

        // Update pipes
        pipesRef.current = pipesRef.current.filter(pipe => {
          pipe.x -= 3;
          
          // Check pass
          if (!pipe.passed && pipe.x + PIPE_WIDTH < CANVAS_WIDTH / 2 - BIRD_SIZE / 2) {
            pipe.passed = true;
            scoreRef.current++;
            setScore(scoreRef.current);
          }
          
          return pipe.x > -PIPE_WIDTH;
        });

        // Collision detection
        const birdLeft = CANVAS_WIDTH / 2 - BIRD_SIZE / 2;
        const birdRight = birdLeft + BIRD_SIZE;
        const birdTop = birdRef.current.y;
        const birdBottom = birdRef.current.y + BIRD_SIZE;

        // Ground/ceiling collision
        if (birdBottom > CANVAS_HEIGHT - 40 || birdTop < 0) {
          setGameState('gameover');
          saveScore(scoreRef.current);
          toast({ title: "Game Over!", description: `Score: ${scoreRef.current}` });
        }

        // Pipe collision
        for (const pipe of pipesRef.current) {
          const pipeLeft = pipe.x;
          const pipeRight = pipe.x + PIPE_WIDTH;
          
          if (birdRight > pipeLeft && birdLeft < pipeRight) {
            if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + PIPE_GAP) {
              setGameState('gameover');
              saveScore(scoreRef.current);
              toast({ title: "Game Over!", description: `Score: ${scoreRef.current}` });
              break;
            }
          }
        }
      }

      // Draw pipes
      ctx.fillStyle = 'hsl(120, 60%, 35%)';
      for (const pipe of pipesRef.current) {
        // Top pipe
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.fillRect(pipe.x - 3, pipe.topHeight - 20, PIPE_WIDTH + 6, 20);
        // Bottom pipe
        const bottomY = pipe.topHeight + PIPE_GAP;
        ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_HEIGHT - bottomY - 40);
        ctx.fillRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 20);
      }

      // Draw bird
      ctx.fillStyle = 'hsl(45, 90%, 55%)';
      ctx.beginPath();
      ctx.ellipse(
        CANVAS_WIDTH / 2,
        birdRef.current.y + BIRD_SIZE / 2,
        BIRD_SIZE / 2,
        BIRD_SIZE / 2 - 2,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      
      // Bird eye
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH / 2 + 6, birdRef.current.y + BIRD_SIZE / 2 - 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH / 2 + 7, birdRef.current.y + BIRD_SIZE / 2 - 3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Score
      ctx.fillStyle = 'white';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(scoreRef.current.toString(), CANVAS_WIDTH / 2, 50);

      if (gameState === 'playing') {
        frameRef.current = requestAnimationFrame(gameLoop);
      }
    };

    frameRef.current = requestAnimationFrame(gameLoop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [gameState]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jump]);

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

      <div className="relative rounded-xl overflow-hidden shadow-lg">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={jump}
          className="cursor-pointer"
        />
        
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Button onClick={jump} variant="hero" size="lg" className="gap-2">
              <Play className="w-5 h-5" /> Start Game
            </Button>
          </div>
        )}
        
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground mb-2">Game Over!</p>
              <p className="text-muted-foreground mb-4">Score: {score}</p>
              <Button onClick={restart} variant="hero">Play Again</Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Click or press Space to flap</p>
    </div>
  );
}