import { useState, useEffect } from 'react';
import { useNavigate, useParams, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useNotifications } from '@/hooks/useNotifications';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { CreateGroupDialog } from '@/components/CreateGroupDialog';
import { NotificationBell } from '@/components/NotificationBell';
import { BetaTagPopup } from '@/components/BetaTagPopup';
import { ThemeSelector } from '@/components/ThemeSelector';
import { TagSelector } from '@/components/TagSelector';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OnlineIndicator } from '@/components/OnlineIndicator';
import { MoodSelector } from '@/components/MoodSelector';
import { 
  MessageCircle, 
  Plus, 
  Copy, 
  Check, 
  LogOut, 
  UserPlus,
  Hash,
  Shield,
  Wifi,
  Users,
  Menu,
  X,
  Gamepad2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Connection {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  other_user?: {
    id: string;
    username: string;
  };
  last_message?: string;
}

interface GroupChat {
  id: string;
  name: string;
  creator_id: string;
  member_count?: number;
  last_message?: string;
}

interface Profile {
  id: string;
  username: string;
  connection_code: string;
}

export default function ChatLayout() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  useNotifications();
  useOnlineStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
  const params = useParams();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [connectCode, setConnectCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<Profile[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeConnectionId = params.connectionId;
  const activeGroupId = params.groupId;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchConnections();
      fetchGroupChats();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const fetchConnections = async () => {
    if (!user) return;
    setLoading(true);

    const { data: connectionsData } = await supabase
      .from('connections')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    const connectionsWithProfiles = await Promise.all(
      (connectionsData || []).map(async (conn) => {
        const otherUserId = conn.user1_id === user.id ? conn.user2_id : conn.user1_id;
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', otherUserId)
          .maybeSingle();

        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content')
          .eq('connection_id', conn.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...conn,
          other_user: profileData || undefined,
          last_message: lastMessage?.content,
        };
      })
    );

    setConnections(connectionsWithProfiles);
    setLoading(false);
  };

  const fetchGroupChats = async () => {
    if (!user) return;

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      setGroupChats([]);
      return;
    }

    const groupIds = memberships.map(m => m.group_id);
    const { data: groups } = await supabase
      .from('group_chats')
      .select('*')
      .in('id', groupIds);

    const groupsWithDetails = await Promise.all(
      (groups || []).map(async (group) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);

        const { data: lastMsg } = await supabase
          .from('group_messages')
          .select('content, message_type')
          .eq('group_id', group.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let lastMessage = 'No messages yet';
        if (lastMsg) {
          if (lastMsg.message_type === 'image') lastMessage = '📷 Image';
          else if (lastMsg.message_type === 'voice') lastMessage = '🎤 Voice';
          else lastMessage = lastMsg.content || '';
        }

        return { ...group, member_count: count || 0, last_message: lastMessage };
      })
    );

    setGroupChats(groupsWithDetails);
  };

  const copyCode = () => {
    if (profile?.connection_code) {
      navigator.clipboard.writeText(profile.connection_code);
      setCopied(true);
      toast({ title: "Code copied!", description: "Share this code with someone to connect." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendFriendRequest = async (targetUserId: string, targetUsername: string) => {
    if (!user) return false;

    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id, status')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      toast({
        title: "Request exists",
        description: existing.status === 'pending' ? "A friend request is already pending." : "You've already interacted with this user.",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase.from('friend_requests').insert({ from_user_id: user.id, to_user_id: targetUserId });

    if (error) {
      toast({ title: "Error", description: "Failed to send friend request.", variant: "destructive" });
      return false;
    }

    toast({ title: "Request sent!", description: `Friend request sent to ${targetUsername}.` });
    return true;
  };

  const handleConnect = async () => {
    if (!user || !connectCode.trim()) return;
    setConnecting(true);

    try {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('connection_code', connectCode.toLowerCase().trim())
        .maybeSingle();

      if (!targetProfile) {
        toast({ title: "Invalid code", description: "No user found with this connection code.", variant: "destructive" });
        setConnecting(false);
        return;
      }

      if (targetProfile.id === user.id) {
        toast({ title: "Invalid code", description: "You can't connect with yourself!", variant: "destructive" });
        setConnecting(false);
        return;
      }

      const { data: existingConnection } = await supabase
        .from('connections')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetProfile.id}),and(user1_id.eq.${targetProfile.id},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingConnection) {
        toast({ title: "Already connected", description: `You're already connected with ${targetProfile.username}.`, variant: "destructive" });
        setConnecting(false);
        return;
      }

      const sent = await sendFriendRequest(targetProfile.id, targetProfile.username);
      if (sent) {
        setConnectCode('');
        setDialogOpen(false);
      }
    } finally {
      setConnecting(false);
    }
  };

  const connectWithUser = async (targetUserId: string, targetUsername: string) => {
    if (!user) return;
    setConnecting(true);

    try {
      if (targetUserId === user.id) {
        toast({ title: "Invalid", description: "You can't connect with yourself!", variant: "destructive" });
        return;
      }

      const { data: existingConnection } = await supabase
        .from('connections')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingConnection) {
        toast({ title: "Already connected", description: `You're already connected with ${targetUsername}.`, variant: "destructive" });
        return;
      }

      const sent = await sendFriendRequest(targetUserId, targetUsername);
      if (sent) {
        setDialogOpen(false);
        setNearbyUsers(prev => prev.filter(u => u.id !== targetUserId));
      }
    } finally {
      setConnecting(false);
    }
  };

  const fetchNearbyUsers = async () => {
    if (!user) return;
    setLoadingNearby(true);

    try {
      await supabase.functions.invoke('nearby-users', { body: { action: 'register' } });
      const { data } = await supabase.functions.invoke('nearby-users', { body: { action: 'find' } });
      setNearbyUsers(data?.users || []);
    } catch {
      setNearbyUsers([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const registerPresence = async () => {
      try {
        await supabase.functions.invoke('nearby-users', { body: { action: 'register' } });
      } catch {}
    };
    registerPresence();
    const interval = setInterval(registerPresence, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (dialogOpen) fetchNearbyUsers();
  }, [dialogOpen]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col gradient-bg overflow-hidden">
      {/* Top Header/Toolbar */}
      <header className="glass-card border-b border-border/50 shrink-0 z-20">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-foreground text-sm">LMS Chats</h1>
              <p className="text-xs text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>

          {/* Center tools */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            {/* Connection Code */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Hash className="w-4 h-4" />
                  <span className="hidden sm:inline font-mono text-xs">{profile?.connection_code?.toUpperCase()}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Your Connection Code</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 font-mono text-sm tracking-widest text-center">
                      {profile?.connection_code?.toUpperCase()}
                    </div>
                    <Button size="icon" variant="outline" onClick={copyCode}>
                      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Add Friends */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Friend</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Friends</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="nearby" className="w-full mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="nearby">Nearby</TabsTrigger>
                    <TabsTrigger value="code">By Code</TabsTrigger>
                  </TabsList>
                  <TabsContent value="nearby" className="mt-4">
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mb-4">
                      <Wifi className="w-4 h-4" />
                      Users on your network
                    </div>
                    {loadingNearby ? (
                      <div className="py-8 text-center">
                        <div className="animate-pulse text-muted-foreground">Searching...</div>
                      </div>
                    ) : nearbyUsers.length === 0 ? (
                      <div className="py-8 text-center bg-accent/20 rounded-xl">
                        <Wifi className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No nearby users</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {nearbyUsers.map((nearbyUser) => (
                          <button
                            key={nearbyUser.id}
                            onClick={() => connectWithUser(nearbyUser.id, nearbyUser.username)}
                            className="w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center gap-3 transition-colors"
                            disabled={connecting}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {nearbyUser.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-foreground text-sm">{nearbyUser.username}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="code" className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Friend's 8-Digit Code</p>
                      <Input
                        placeholder="E.G., ABC12345"
                        value={connectCode}
                        onChange={(e) => setConnectCode(e.target.value)}
                        className="h-10 text-center font-mono tracking-widest uppercase bg-secondary/50"
                        maxLength={8}
                      />
                    </div>
                    <Button onClick={handleConnect} disabled={connecting || connectCode.length < 8} className="w-full" variant="hero">
                      {connecting ? 'Sending...' : 'Send Friend Request'}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <CreateGroupDialog onGroupCreated={fetchGroupChats} />
          </div>

          {/* Right tools */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/games')} title="Games">
              <Gamepad2 className="w-5 h-5" />
            </Button>
            <MoodSelector />
            <TagSelector />
            <ThemeSelector />
            <NotificationBell />
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <Shield className="w-5 h-5 text-primary" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <AnnouncementBanner />
      <BetaTagPopup />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Chat List */}
        <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} md:w-80 shrink-0 border-r border-border/50 glass-card transition-all duration-300 overflow-hidden`}>
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              {/* Group Chats */}
              {groupChats.length > 0 && (
                <div className="space-y-1">
                  <h2 className="text-xs font-medium text-muted-foreground px-2 uppercase tracking-wider">
                    Groups ({groupChats.length})
                  </h2>
                  {groupChats.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => { navigate(`/group/${group.id}`); setSidebarOpen(false); }}
                      className={`w-full rounded-lg p-3 flex items-center gap-3 transition-all ${
                        activeGroupId === group.id
                          ? 'bg-primary/20 border border-primary/30'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-medium text-foreground text-sm truncate">{group.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {group.member_count} members
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Direct Messages */}
              <div className="space-y-1">
                <h2 className="text-xs font-medium text-muted-foreground px-2 uppercase tracking-wider">
                  Messages ({connections.length})
                </h2>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg p-3 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-muted rounded w-20" />
                            <div className="h-2 bg-muted rounded w-32" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : connections.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Plus className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No connections yet</p>
                  </div>
                ) : (
                  connections.map((connection) => (
                    <button
                      key={connection.id}
                      onClick={() => { navigate(`/chat/${connection.id}`); setSidebarOpen(false); }}
                      className={`w-full rounded-lg p-3 flex items-center gap-3 transition-all ${
                        activeConnectionId === connection.id
                          ? 'bg-primary/20 border border-primary/30'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {connection.other_user?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                        {connection.other_user && (
                          <div className="absolute -bottom-0.5 -right-0.5">
                            <OnlineIndicator userId={connection.other_user.id} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-medium text-foreground text-sm truncate">
                          {connection.other_user?.username || 'Unknown'}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {connection.last_message || 'No messages yet'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet context={{ fetchConnections, fetchGroupChats }} />
        </main>
      </div>
    </div>
  );
}
