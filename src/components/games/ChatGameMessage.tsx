import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gamepad2, Trophy } from 'lucide-react';
import { ChatGameDialog } from './ChatGameDialog';
import { useAuth } from '@/hooks/useAuth';

export function ChatGameMessage({ gameId, isOwn }: { gameId: string; isOwn: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<{ type: string; status: string; winner_id: string | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from('chat_games')
        .select('game_type, status, winner_id').eq('id', gameId).maybeSingle();
      if (mounted && data) setMeta({ type: data.game_type, status: data.status, winner_id: data.winner_id });
    };
    load();

    const channel = supabase
      .channel(`chat_game_msg-${gameId}-${Math.random().toString(36).slice(2,7)}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_games', filter: `id=eq.${gameId}` },
        (payload) => { if (mounted) setMeta({ type: (payload.new as any).game_type, status: (payload.new as any).status, winner_id: (payload.new as any).winner_id }); }
      )
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [gameId]);

  const label = meta?.type === 'tictactoe' ? 'Tic-Tac-Toe' : meta?.type === 'rps' ? 'Rock · Paper · Scissors' : 'Game';
  const statusText = meta?.status === 'finished'
    ? meta.winner_id === user?.id ? 'You won' : meta.winner_id ? 'You lost' : 'Draw'
    : meta?.status === 'active' ? 'In progress' : 'Tap to accept';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border transition-all ${
          isOwn
            ? 'bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/15'
            : 'bg-background/40 border-border/60 hover:border-primary/40'
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          meta?.status === 'finished' ? 'bg-amber-500/20' : 'bg-primary/20'
        }`}>
          {meta?.status === 'finished'
            ? <Trophy className="w-5 h-5 text-amber-400" />
            : <Gamepad2 className={`w-5 h-5 ${isOwn ? 'text-primary-foreground' : 'text-primary'}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-display font-bold ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>{label}</p>
          <p className={`text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{statusText}</p>
        </div>
      </button>
      <ChatGameDialog gameId={gameId} open={open} onOpenChange={setOpen} />
    </>
  );
}
