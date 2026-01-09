import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      // Only show browser notification if document is hidden
      if (document.hidden) {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Request permission on mount
    requestPermission();

    // Subscribe to new direct messages
    const messagesChannel = supabase
      .channel('notifications-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const msg = payload.new as { sender_id: string; content: string; connection_id: string };
          
          // Don't notify for own messages
          if (msg.sender_id === user.id) return;

          // Check if this connection involves the current user
          const { data: connection } = await supabase
            .from('connections')
            .select('*')
            .eq('id', msg.connection_id)
            .maybeSingle();

          if (!connection) return;
          if (connection.user1_id !== user.id && connection.user2_id !== user.id) return;

          // Get sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', msg.sender_id)
            .maybeSingle();

          const senderName = sender?.username || 'Someone';

          toast({
            title: `New message from ${senderName}`,
            description: msg.content?.substring(0, 50) || 'Sent a message',
          });

          showNotification(`New message from ${senderName}`, {
            body: msg.content?.substring(0, 100) || 'Sent a message',
            tag: `message-${msg.connection_id}`,
          });
        }
      )
      .subscribe();

    // Subscribe to new group messages
    const groupMessagesChannel = supabase
      .channel('notifications-group-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
        },
        async (payload) => {
          const msg = payload.new as { sender_id: string; content: string | null; group_id: string; message_type: string };
          
          // Don't notify for own messages
          if (msg.sender_id === user.id) return;

          // Check if user is a member of this group
          const { data: membership } = await supabase
            .from('group_members')
            .select('*')
            .eq('group_id', msg.group_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!membership) return;

          // Get group and sender info
          const [{ data: group }, { data: sender }] = await Promise.all([
            supabase.from('group_chats').select('name').eq('id', msg.group_id).maybeSingle(),
            supabase.from('profiles').select('username').eq('id', msg.sender_id).maybeSingle(),
          ]);

          const groupName = group?.name || 'Group';
          const senderName = sender?.username || 'Someone';
          const messagePreview = msg.message_type === 'text' 
            ? msg.content?.substring(0, 50) || 'Sent a message'
            : msg.message_type === 'image' 
              ? '📷 Sent an image'
              : '🎤 Sent a voice message';

          toast({
            title: `${senderName} in ${groupName}`,
            description: messagePreview,
          });

          showNotification(`${senderName} in ${groupName}`, {
            body: messagePreview,
            tag: `group-${msg.group_id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(groupMessagesChannel);
    };
  }, [user, toast, showNotification, requestPermission]);

  return { requestPermission, showNotification };
}
