import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  const showBrowserNotification = useCallback((title: string, options?: NotificationOptions & { url?: string }) => {
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
      if (options?.url) {
        n.onclick = () => {
          window.focus();
          window.location.href = options.url!;
        };
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    requestPermission();

    const isViewing = (path: string) =>
      location.pathname === path || location.pathname.startsWith(path + '/');

    const isTabActive = () => document.visibilityState === 'visible' && document.hasFocus();

    const messagesChannel = supabase
      .channel(`notifications-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as { sender_id: string; content: string; connection_id: string; message_type?: string };
          if (msg.sender_id === user.id) return;

          const { data: connection } = await supabase
            .from('connections')
            .select('*')
            .eq('id', msg.connection_id)
            .maybeSingle();

          if (!connection) return;
          if (connection.user1_id !== user.id && connection.user2_id !== user.id) return;

          // Skip if currently viewing this chat AND tab is active
          const chatPath = `/chats/chat/${msg.connection_id}`;
          const altPath = `/chat/${msg.connection_id}`;
          if (isTabActive() && (isViewing(chatPath) || isViewing(altPath))) return;

          const { data: sender } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', msg.sender_id)
            .maybeSingle();

          const senderName = sender?.username || 'Someone';
          const preview = msg.message_type === 'image'
            ? '📷 Sent an image'
            : msg.message_type === 'voice'
              ? '🎤 Sent a voice message'
              : msg.content?.substring(0, 80) || 'Sent a message';

          if (isTabActive()) {
            toast({
              title: `New message from ${senderName}`,
              description: preview,
            });
          } else {
            showBrowserNotification(`New message from ${senderName}`, {
              body: preview,
              tag: `message-${msg.connection_id}`,
              url: chatPath,
            });
          }
        }
      )
      .subscribe();

    const groupMessagesChannel = supabase
      .channel(`notifications-group-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        async (payload) => {
          const msg = payload.new as { sender_id: string; content: string | null; group_id: string; message_type: string };
          if (msg.sender_id === user.id) return;

          const { data: membership } = await supabase
            .from('group_members')
            .select('*')
            .eq('group_id', msg.group_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!membership) return;

          const groupPath = `/chats/group/${msg.group_id}`;
          const altPath = `/group/${msg.group_id}`;
          if (isTabActive() && (isViewing(groupPath) || isViewing(altPath))) return;

          const [{ data: group }, { data: sender }] = await Promise.all([
            supabase.from('group_chats').select('name').eq('id', msg.group_id).maybeSingle(),
            supabase.from('profiles').select('username').eq('id', msg.sender_id).maybeSingle(),
          ]);

          const groupName = group?.name || 'Group';
          const senderName = sender?.username || 'Someone';
          const preview = msg.message_type === 'text'
            ? msg.content?.substring(0, 80) || 'Sent a message'
            : msg.message_type === 'image'
              ? '📷 Sent an image'
              : '🎤 Sent a voice message';

          if (isTabActive()) {
            toast({
              title: `${senderName} in ${groupName}`,
              description: preview,
            });
          } else {
            showBrowserNotification(`${senderName} in ${groupName}`, {
              body: preview,
              tag: `group-${msg.group_id}`,
              url: groupPath,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(groupMessagesChannel);
    };
  }, [user, toast, showBrowserNotification, requestPermission, location.pathname]);

  return { requestPermission, showNotification: showBrowserNotification };
}
