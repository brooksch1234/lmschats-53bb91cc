import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface OnlineIndicatorProps {
  userId: string;
  showText?: boolean;
  size?: 'sm' | 'md';
}

export function OnlineIndicator({ userId, showText = false, size = 'sm' }: OnlineIndicatorProps) {
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    fetchLastSeen();
    
    const channel = supabase
      .channel(`presence:${userId}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload: any) => {
          if (payload.new?.last_seen_at) {
            const seen = new Date(payload.new.last_seen_at);
            setLastSeen(seen);
            setIsOnline(Date.now() - seen.getTime() < 2 * 60 * 1000);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const fetchLastSeen = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('last_seen_at')
      .eq('id', userId)
      .maybeSingle();
    
    if (data?.last_seen_at) {
      const seen = new Date(data.last_seen_at);
      setLastSeen(seen);
      setIsOnline(Date.now() - seen.getTime() < 2 * 60 * 1000);
    }
  };

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  if (showText) {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`${dotSize} rounded-full ${isOnline ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
        <span className="text-xs text-muted-foreground">
          {isOnline ? 'Online' : lastSeen ? `Last seen ${formatDistanceToNow(lastSeen, { addSuffix: true })}` : 'Offline'}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`${dotSize} rounded-full ${isOnline ? 'bg-green-500' : 'bg-muted-foreground/50'}`}
      title={isOnline ? 'Online' : lastSeen ? `Last seen ${formatDistanceToNow(lastSeen, { addSuffix: true })}` : 'Offline'}
    />
  );
}