import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Gamepad2 } from 'lucide-react';

interface Props {
  connectionId: string;
  otherUserId: string;
  disabled?: boolean;
}

const GAMES = [
  { type: 'tictactoe', label: 'Tic-Tac-Toe', emoji: '⭕', desc: '3-in-a-row' },
  { type: 'rps', label: 'Rock · Paper · Scissors', emoji: '✊', desc: 'First to 3' },
];

export function ChatGamePicker({ connectionId, otherUserId, disabled }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const invite = async (gameType: string) => {
    if (!user) return;
    setSending(true);
    try {
      const initialState = gameType === 'tictactoe'
        ? { board: Array(9).fill('') }
        : { picks: {}, round: 1, scores: { [user.id]: 0, [otherUserId]: 0 } };

      const { data: game, error } = await supabase
        .from('chat_games')
        .insert({
          connection_id: connectionId,
          game_type: gameType,
          player1_id: user.id,
          player2_id: otherUserId,
          state: initialState,
          current_turn: user.id,
          status: 'pending',
        })
        .select().single();

      if (error || !game) {
        toast({ title: 'Could not start game', description: error?.message, variant: 'destructive' });
        return;
      }

      const label = GAMES.find(g => g.type === gameType)?.label || 'Game';
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          connection_id: connectionId,
          sender_id: user.id,
          content: `🎮 ${label} invite`,
          message_type: 'game',
          media_url: game.id,
        })
        .select().single();

      if (msgErr) {
        toast({ title: 'Game created but invite failed', description: msgErr.message, variant: 'destructive' });
      } else {
        toast({ title: 'Challenge sent!', description: `Waiting for them to accept ${label}.` });
        // Notify parent ChatView to render the new message immediately
        window.dispatchEvent(new CustomEvent('chat-game-invite-sent', { detail: { msg } }));
      }
      setOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled || sending} title="Challenge to a game">
          <Gamepad2 className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono px-2 py-1.5">Challenge to a game</p>
        <div className="space-y-1">
          {GAMES.map(g => (
            <button
              key={g.type}
              onClick={() => invite(g.type)}
              disabled={sending}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left transition-colors"
            >
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{g.label}</p>
                <p className="text-xs text-muted-foreground">{g.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
