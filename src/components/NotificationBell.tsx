import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Bell, Check, X, MessageCircle, UserPlus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface UnreadItem {
  type: 'connection' | 'group';
  id: string;
  name: string;
  count: number;
  lastMessage?: string;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_user?: {
    username: string;
  };
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  // Unread messages state
  const [unreadItems, setUnreadItems] = useState<UnreadItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  
  // Friend requests state
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchUnreadCounts = async () => {
    if (!user) return;

    try {
      const { data: connections } = await supabase
        .from('connections')
        .select('id, user1_id, user2_id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

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

  const fetchRequests = async () => {
    if (!user) return;
    setLoadingRequests(true);

    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error);
      setLoadingRequests(false);
      return;
    }

    const requestsWithProfiles = await Promise.all(
      (data || []).map(async (req) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', req.from_user_id)
          .maybeSingle();
        
        return { ...req, from_user: profile || undefined };
      })
    );

    setRequests(requestsWithProfiles);
    setLoadingRequests(false);
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCounts();
      fetchRequests();

      const interval = setInterval(fetchUnreadCounts, 30000);

      const messagesChannel = supabase
        .channel('unified-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchUnreadCounts)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, fetchUnreadCounts)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `to_user_id=eq.${user.id}` }, () => {
          fetchRequests();
          toast({ title: "New friend request!", description: "Someone wants to connect with you." });
        })
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [user]);

  const handleAccept = async (request: FriendRequest) => {
    if (!user) return;

    const connectionPayload = {
      user1_id: user.id,
      user2_id: request.from_user_id,
    };

    const { data: existingConnection } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${request.from_user_id}),and(user1_id.eq.${request.from_user_id},user2_id.eq.${user.id})`)
      .maybeSingle();

    const { error: connError } = existingConnection
      ? { error: null }
      : await supabase
          .from('connections')
          .insert(connectionPayload);

    if (connError) {
      toast({ title: "Error", description: "Failed to create connection.", variant: "destructive" });
      return;
    }

    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', request.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to accept request.", variant: "destructive" });
      return;
    }

    toast({ title: "Request accepted!", description: `You're now connected with ${request.from_user?.username || 'this user'}.` });
    setRequests(prev => prev.filter(r => r.id !== request.id));
  };

  const handleDecline = async (request: FriendRequest) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined' })
      .eq('id', request.id);

    if (error) {
      toast({ title: "Error", description: "Failed to decline request.", variant: "destructive" });
      return;
    }

    toast({ title: "Request declined" });
    setRequests(prev => prev.filter(r => r.id !== request.id));
  };

  const handleMessageClick = (item: UnreadItem) => {
    setOpen(false);
    if (item.type === 'connection') {
      navigate(`/chat/${item.id}`);
    } else {
      navigate(`/group/${item.id}`);
    }
  };

  const totalNotifications = totalUnread + requests.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {totalNotifications > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground">
              {totalNotifications > 99 ? '99+' : totalNotifications}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="glass-card border-border/50 p-0">
        <SheetHeader className="p-4 border-b border-border/50">
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="w-full rounded-none border-b border-border/50 bg-transparent h-12">
            <TabsTrigger value="messages" className="flex-1 gap-2 data-[state=active]:bg-secondary/50">
              <MessageCircle className="w-4 h-4" />
              Messages
              {totalUnread > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {totalUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex-1 gap-2 data-[state=active]:bg-secondary/50">
              <UserPlus className="w-4 h-4" />
              Requests
              {requests.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {requests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="m-0">
            <ScrollArea className="h-[calc(100vh-180px)]">
              {unreadItems.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No unread messages</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {unreadItems.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleMessageClick(item)}
                      className="w-full p-3 rounded-lg hover:bg-secondary/50 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {item.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground text-sm truncate">
                              {item.name}
                            </p>
                            {item.type === 'group' && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Group</Badge>
                            )}
                          </div>
                          {item.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.lastMessage}
                            </p>
                          )}
                        </div>
                        <Badge className="shrink-0 bg-primary text-primary-foreground">
                          {item.count}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="requests" className="m-0">
            <ScrollArea className="h-[calc(100vh-180px)]">
              {loadingRequests ? (
                <div className="p-8 text-center">
                  <div className="animate-pulse text-muted-foreground">Loading...</div>
                </div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center">
                  <UserPlus className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No pending requests</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {request.from_user?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">
                          {request.from_user?.username || 'Unknown user'}
                        </p>
                        <p className="text-xs text-muted-foreground">wants to connect</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                          onClick={() => handleAccept(request)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleDecline(request)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}