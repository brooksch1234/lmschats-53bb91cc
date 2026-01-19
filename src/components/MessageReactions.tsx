import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';

interface MessageReactionsProps {
  messageId: string;
  isOwn: boolean;
}

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

const EMOJI_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export function MessageReactions({ messageId, isOwn }: MessageReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchReactions();
    
    const channel = supabase
      .channel(`reactions:${messageId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'message_reactions', filter: `message_id=eq.${messageId}` },
        () => fetchReactions()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messageId]);

  const fetchReactions = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', messageId);

    if (data) {
      const grouped = data.reduce((acc, r) => {
        if (!acc[r.emoji]) {
          acc[r.emoji] = { emoji: r.emoji, count: 0, hasReacted: false };
        }
        acc[r.emoji].count++;
        if (r.user_id === user.id) {
          acc[r.emoji].hasReacted = true;
        }
        return acc;
      }, {} as Record<string, Reaction>);
      
      setReactions(Object.values(grouped));
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (!user) return;

    const existing = reactions.find(r => r.emoji === emoji && r.hasReacted);
    
    if (existing) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji });
    }
    
    setOpen(false);
  };

  return (
    <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(r.emoji)}
          className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 transition-colors
            ${r.hasReacted 
              ? 'bg-primary/20 text-primary' 
              : 'bg-secondary/50 hover:bg-secondary text-foreground'
            }`}
        >
          <span>{r.emoji}</span>
          <span className="text-[10px]">{r.count}</span>
        </button>
      ))}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <SmilePlus className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className="text-lg hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}