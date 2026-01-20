import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, Delete } from 'lucide-react';

// Common 5-letter words for the game
const WORDS = [
  'APPLE', 'BEACH', 'BRAIN', 'BREAD', 'BRING', 'BRUSH', 'BUILD', 'CHAIR', 'CHARM', 'CHASE',
  'CHEST', 'CHILD', 'CLEAN', 'CLEAR', 'CLIMB', 'CLOSE', 'CLOUD', 'COAST', 'COLOR', 'COUNT',
  'COVER', 'CRAFT', 'CREAM', 'DANCE', 'DREAM', 'DRINK', 'DRIVE', 'EARTH', 'ENJOY', 'ENTER',
  'EVENT', 'EVERY', 'FIELD', 'FIGHT', 'FINAL', 'FLASH', 'FLOOR', 'FOCUS', 'FORCE', 'FOUND',
  'FRAME', 'FRESH', 'FRONT', 'FRUIT', 'GLASS', 'GRACE', 'GRAND', 'GRANT', 'GRASS', 'GREAT',
  'GREEN', 'GROUP', 'GUARD', 'GUESS', 'GUIDE', 'HAPPY', 'HEART', 'HEAVY', 'HORSE', 'HOTEL',
  'HOUSE', 'HUMAN', 'IMAGE', 'JUDGE', 'JUICE', 'KNOWN', 'LARGE', 'LAUGH', 'LAYER', 'LEARN',
  'LEAVE', 'LEVEL', 'LIGHT', 'LIMIT', 'LOCAL', 'LOOSE', 'LOWER', 'LUNCH', 'MAGIC', 'MAJOR',
  'MARCH', 'MATCH', 'MAYBE', 'MEDIA', 'METAL', 'MIGHT', 'MINOR', 'MODEL', 'MONEY', 'MONTH',
  'MORAL', 'MOTOR', 'MOUNT', 'MOUSE', 'MOUTH', 'MOVIE', 'MUSIC', 'NIGHT', 'NOISE', 'NORTH',
  'NOTED', 'NOVEL', 'NURSE', 'OCEAN', 'OFFER', 'ORDER', 'OTHER', 'OUTER', 'OWNER', 'PAINT',
  'PANEL', 'PAPER', 'PARTY', 'PEACE', 'PHONE', 'PHOTO', 'PIANO', 'PIECE', 'PILOT', 'PITCH',
  'PLACE', 'PLAIN', 'PLANE', 'PLANT', 'PLATE', 'POINT', 'POUND', 'POWER', 'PRESS', 'PRICE',
  'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE', 'PROOF', 'PROUD', 'PROVE', 'QUICK', 'QUIET',
  'QUITE', 'RADIO', 'RAISE', 'RANCH', 'RANGE', 'RAPID', 'RATIO', 'REACH', 'READY', 'REALM',
  'RIDER', 'RIDGE', 'RIGHT', 'RIVER', 'ROBOT', 'ROUGH', 'ROUND', 'ROUTE', 'ROYAL', 'RURAL',
  'SCALE', 'SCENE', 'SCOPE', 'SCORE', 'SENSE', 'SERVE', 'SEVEN', 'SHAKE', 'SHALL', 'SHAPE',
  'SHARE', 'SHARP', 'SHEET', 'SHELF', 'SHELL', 'SHIFT', 'SHINE', 'SHIRT', 'SHOCK', 'SHOOT',
  'SHORT', 'SHOWN', 'SIGHT', 'SINCE', 'SIXTH', 'SIXTY', 'SIZED', 'SKILL', 'SLEEP', 'SLIDE',
  'SMALL', 'SMART', 'SMILE', 'SMITH', 'SMOKE', 'SOLID', 'SOLVE', 'SORRY', 'SOUND', 'SOUTH',
  'SPACE', 'SPARE', 'SPEAK', 'SPEED', 'SPEND', 'SPENT', 'SPLIT', 'SPOKE', 'SPORT', 'STAFF',
  'STAGE', 'STAKE', 'STAND', 'START', 'STATE', 'STEAM', 'STEEL', 'STICK', 'STILL', 'STOCK',
  'STONE', 'STOOD', 'STORE', 'STORM', 'STORY', 'STRIP', 'STUCK', 'STUDY', 'STUFF', 'STYLE',
  'SUGAR', 'SUITE', 'SUPER', 'SWEET', 'SWIFT', 'SWING', 'TABLE', 'TAKEN', 'TASTE', 'TEACH',
  'TEETH', 'THANK', 'THEME', 'THERE', 'THESE', 'THICK', 'THING', 'THINK', 'THIRD', 'THOSE',
  'THREE', 'THROW', 'THUMB', 'TIGHT', 'TITLE', 'TODAY', 'TOPIC', 'TOTAL', 'TOUCH', 'TOUGH',
  'TOWER', 'TRACK', 'TRADE', 'TRAIN', 'TRASH', 'TREAT', 'TREND', 'TRIAL', 'TRIBE', 'TRICK',
  'TRIED', 'TRUCK', 'TRULY', 'TRUST', 'TRUTH', 'TWICE', 'UNCLE', 'UNDER', 'UNION', 'UNITY',
  'UNTIL', 'UPPER', 'UPSET', 'URBAN', 'USUAL', 'VALID', 'VALUE', 'VIDEO', 'VIRUS', 'VISIT',
  'VITAL', 'VOCAL', 'VOICE', 'WASTE', 'WATCH', 'WATER', 'WHEEL', 'WHERE', 'WHICH', 'WHITE',
  'WHOLE', 'WHOSE', 'WOMAN', 'WOMEN', 'WORLD', 'WORRY', 'WORSE', 'WORST', 'WORTH', 'WOULD',
  'WOUND', 'WRITE', 'WRONG', 'WROTE', 'YIELD', 'YOUNG', 'YOUTH', 'ZEBRA', 'ZONES',
];

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

interface Letter {
  char: string;
  status: LetterStatus;
}

export function WordleGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState<Letter[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [stats, setStats] = useState({ played: 0, won: 0, streak: 0 });
  const [keyboardStatus, setKeyboardStatus] = useState<Record<string, LetterStatus>>({});

  useEffect(() => {
    const saved = localStorage.getItem('wordle-stats');
    if (saved) setStats(JSON.parse(saved));
    startNewGame();
  }, []);

  const startNewGame = () => {
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    setTargetWord(randomWord);
    setGuesses([]);
    setCurrentGuess('');
    setGameState('playing');
    setKeyboardStatus({});
  };

  const saveStats = (won: boolean) => {
    const newStats = {
      played: stats.played + 1,
      won: won ? stats.won + 1 : stats.won,
      streak: won ? stats.streak + 1 : 0,
    };
    setStats(newStats);
    localStorage.setItem('wordle-stats', JSON.stringify(newStats));
  };

  const saveScore = async (attempts: number) => {
    if (!user) return;
    await supabase.from('game_scores').insert({
      user_id: user.id,
      game_type: 'wordle',
      score: (MAX_ATTEMPTS - attempts + 1) * 100, // More points for fewer attempts
    });
  };

  const evaluateGuess = (guess: string): Letter[] => {
    const result: Letter[] = [];
    const targetChars = targetWord.split('');
    const guessChars = guess.split('');
    
    // First pass: mark correct positions
    guessChars.forEach((char, i) => {
      if (char === targetChars[i]) {
        result[i] = { char, status: 'correct' };
        targetChars[i] = '#'; // Mark as used
      }
    });
    
    // Second pass: mark present letters
    guessChars.forEach((char, i) => {
      if (!result[i]) {
        const targetIndex = targetChars.indexOf(char);
        if (targetIndex !== -1) {
          result[i] = { char, status: 'present' };
          targetChars[targetIndex] = '#';
        } else {
          result[i] = { char, status: 'absent' };
        }
      }
    });
    
    return result;
  };

  const updateKeyboardStatus = (letters: Letter[]) => {
    const newStatus = { ...keyboardStatus };
    letters.forEach(({ char, status }) => {
      const current = newStatus[char];
      if (status === 'correct' || (status === 'present' && current !== 'correct') || 
          (status === 'absent' && !current)) {
        newStatus[char] = status;
      }
    });
    setKeyboardStatus(newStatus);
  };

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== WORD_LENGTH || gameState !== 'playing') return;
    
    const evaluated = evaluateGuess(currentGuess);
    const newGuesses = [...guesses, evaluated];
    setGuesses(newGuesses);
    updateKeyboardStatus(evaluated);
    
    if (currentGuess === targetWord) {
      setGameState('won');
      saveStats(true);
      saveScore(newGuesses.length);
      toast({ title: "🎉 Brilliant!", description: `You got it in ${newGuesses.length} tries!` });
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      setGameState('lost');
      saveStats(false);
      toast({ title: "Game Over!", description: `The word was ${targetWord}` });
    }
    
    setCurrentGuess('');
  }, [currentGuess, guesses, targetWord, gameState]);

  const handleKeyPress = useCallback((key: string) => {
    if (gameState !== 'playing') return;
    
    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, submitGuess, gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const key = e.key.toUpperCase();
      if (key === 'ENTER' || key === 'BACKSPACE' || /^[A-Z]$/.test(key)) {
        e.preventDefault();
        handleKeyPress(key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  const getStatusColor = (status: LetterStatus): string => {
    switch (status) {
      case 'correct': return 'bg-green-500 border-green-500 text-white';
      case 'present': return 'bg-yellow-500 border-yellow-500 text-white';
      case 'absent': return 'bg-secondary border-secondary text-muted-foreground';
      default: return 'bg-secondary/30 border-border';
    }
  };

  const keyboard = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
  ];

  const renderGrid = () => {
    const rows = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const guess = guesses[i];
      const isCurrentRow = i === guesses.length && gameState === 'playing';
      
      rows.push(
        <div key={i} className="flex gap-1.5 justify-center">
          {Array(WORD_LENGTH).fill(null).map((_, j) => {
            let letter: Letter;
            if (guess) {
              letter = guess[j];
            } else if (isCurrentRow && currentGuess[j]) {
              letter = { char: currentGuess[j], status: 'empty' };
            } else {
              letter = { char: '', status: 'empty' };
            }
            
            return (
              <div
                key={j}
                className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center 
                  font-bold text-xl transition-all ${getStatusColor(letter.status)}
                  ${isCurrentRow && currentGuess[j] ? 'scale-105' : ''}`}
              >
                {letter.char}
              </div>
            );
          })}
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-xs">
        <div className="flex gap-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Played</p>
            <p className="text-lg font-bold text-foreground">{stats.played}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Won</p>
            <p className="text-lg font-bold text-green-500">{stats.won}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Streak</p>
            <p className="text-lg font-bold text-primary">{stats.streak}</p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={startNewGame}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-1.5">
        {renderGrid()}
      </div>

      {/* Keyboard */}
      <div className="flex flex-col gap-1.5 mt-2">
        {keyboard.map((row, i) => (
          <div key={i} className="flex gap-1 justify-center">
            {row.map(key => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className={`h-10 rounded font-semibold text-sm transition-all
                  ${key === 'ENTER' || key === 'BACKSPACE' ? 'px-2 min-w-[52px]' : 'w-8'}
                  ${keyboardStatus[key] ? getStatusColor(keyboardStatus[key]) : 'bg-secondary/50 hover:bg-secondary'}
                `}
              >
                {key === 'BACKSPACE' ? <Delete className="w-4 h-4 mx-auto" /> : key}
              </button>
            ))}
          </div>
        ))}
      </div>

      {gameState !== 'playing' && (
        <div className="text-center mt-2">
          <p className="text-lg font-bold text-foreground mb-2">
            {gameState === 'won' ? '🎉 You Got It!' : `The word was: ${targetWord}`}
          </p>
          <Button onClick={startNewGame} variant="hero" size="sm">Play Again</Button>
        </div>
      )}
    </div>
  );
}
