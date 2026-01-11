import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TypingUser {
  id: string;
  username: string;
}

export function useTypingIndicator(channelName: string, username: string) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!user || !channelName) return;

    const channel = supabase.channel(`typing:${channelName}`);
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.isTyping && presence.userId !== user.id) {
              users.push({ id: presence.userId, username: presence.username });
            }
          });
        });
        
        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            username,
            isTyping: false,
          });
        }
      });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user, channelName, username]);

  const startTyping = useCallback(async () => {
    if (!channelRef.current || !user || isTypingRef.current) return;
    
    isTypingRef.current = true;
    await channelRef.current.track({
      userId: user.id,
      username,
      isTyping: true,
    });

    // Auto-stop typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [user, username]);

  const stopTyping = useCallback(async () => {
    if (!channelRef.current || !user) return;
    
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    await channelRef.current.track({
      userId: user.id,
      username,
      isTyping: false,
    });
  }, [user, username]);

  const handleInputChange = useCallback(() => {
    startTyping();
  }, [startTyping]);

  return { typingUsers, handleInputChange, stopTyping };
}
