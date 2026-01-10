import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';

interface UnreadItem {
  type: 'connection' | 'group';
  id: string;
  name: string;
  count: number;
  lastMessage?: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadItems, setUnreadItems] = useState<UnreadItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchUnreadCounts = async () => {
    if (!user) return;

    try {
      // Get user's connections
      const { data: connections } = await supabase
        .from('connections')
        .select('id, user1_id, user2_id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      // Get user's group memberships
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      // Get read timestamps
      const { data: reads } = await supabase
        .from('message_reads')
        .select('*')
        .eq('user_id', user.id);

      const readMap = new Map<string, Date>();
      reads?.forEach(r => {
        if (r.connection_id) readMap.set(`conn-${r.connection_id}`, new Date(r.last_read_at));
        if (r.group_id) readMap.set(`group-${r.group_id}`, new Date(r.last_read_at));
      });

      const items: UnreadItem[] = [];

      // Count unread direct messages
      for (const conn of connections || []) {
        const lastRead = readMap.get(`conn-${conn.id}`) || new Date(0);
        
        const { count, data: lastMsg } = await supabase
          .from('messages')
          .select('content', { count: 'exact' })
          .eq('connection_id', conn.id)
          .neq('sender_id', user.id)
          .gt('created_at', lastRead.toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (count && count > 0) {
          const otherUserId = conn.user1_id === user.id ? conn.user2_id : conn.user1_id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', otherUserId)
            .maybeSingle();

          items.push({
            type: 'connection',
            id: conn.id,
            name: profile?.username || 'Unknown',
            count: count,
            lastMessage: lastMsg?.[0]?.content?.substring(0, 40),
          });
        }
      }

      // Count unread group messages
      for (const membership of memberships || []) {
        const lastRead = readMap.get(`group-${membership.group_id}`) || new Date(0);
        
        const { count, data: lastMsg } = await supabase
          .from('group_messages')
          .select('content, message_type', { count: 'exact' })
          .eq('group_id', membership.group_id)
          .neq('sender_id', user.id)
          .gt('created_at', lastRead.toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (count && count > 0) {
          const { data: group } = await supabase
            .from('group_chats')
            .select('name')
            .eq('id', membership.group_id)
            .maybeSingle();

          const msg = lastMsg?.[0];
          let preview = msg?.content?.substring(0, 40);
          if (msg?.message_type === 'image') preview = '📷 Image';
          if (msg?.message_type === 'voice') preview = '🎤 Voice';

          items.push({
            type: 'group',
            id: membership.group_id,
            name: group?.name || 'Group',
            count: count,
            lastMessage: preview,
          });
        }
      }

      setUnreadItems(items);
      setTotalUnread(items.reduce((sum, i) => sum + i.count, 0));
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCounts();

      // Refresh every 30 seconds
      const interval = setInterval(fetchUnreadCounts, 30000);

      // Also listen for new messages
      const channel = supabase
        .channel('unread-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchUnreadCounts)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, fetchUnreadCounts)
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleItemClick = (item: UnreadItem) => {
    setOpen(false);
    if (item.type === 'connection') {
      navigate(`/chat/${item.id}`);
    } else {
      navigate(`/group/${item.id}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Unread Messages</h3>
        </div>
        <ScrollArea className="max-h-80">
          {unreadItems.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No unread messages</p>
            </div>
          ) : (
            <div className="p-1">
              {unreadItems.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleItemClick(item)}
                  className="w-full p-3 rounded-lg hover:bg-secondary/50 text-left transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          {item.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {item.name}
                          {item.type === 'group' && <span className="text-muted-foreground ml-1">(Group)</span>}
                        </p>
                        {item.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {item.lastMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 font-medium">
                      {item.count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}