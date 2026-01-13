import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { CreateGroupDialog } from '@/components/CreateGroupDialog';
import { NotificationBell } from '@/components/NotificationBell';
import { BetaTagPopup } from '@/components/BetaTagPopup';
import { ThemeSelector } from '@/components/ThemeSelector';
import { 
  MessageCircle, 
  Plus, 
  Copy, 
  Check, 
  LogOut, 
  UserPlus,
  ChevronRight,
  Hash,
  Shield,
  Wifi,
  Users
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

export default function Chats() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  useNotifications(); // Initialize notifications
  const navigate = useNavigate();
  const { toast } = useToast();
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
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data);
    }
  };

  const fetchConnections = async () => {
    if (!user) return;
    setLoading(true);

    const { data: connectionsData, error } = await supabase
      .from('connections')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (error) {
      console.error('Error fetching connections:', error);
      setLoading(false);
      return;
    }

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
          else if (lastMsg.message_type === 'voice') lastMessage = '🎤 Voice message';
          else lastMessage = lastMsg.content || '';
        }

        return {
          ...group,
          member_count: count || 0,
          last_message: lastMessage,
        };
      })
    );

    setGroupChats(groupsWithDetails);
  };

  const copyCode = () => {
    if (profile?.connection_code) {
      navigator.clipboard.writeText(profile.connection_code);
      setCopied(true);
      toast({
        title: "Code copied!",
        description: "Share this code with someone to connect.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendFriendRequest = async (targetUserId: string, targetUsername: string) => {
    if (!user) return;

    // Check if request already exists
    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id, status')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      toast({
        title: "Request exists",
        description: existing.status === 'pending' 
          ? "A friend request is already pending." 
          : "You've already interacted with this user.",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase
      .from('friend_requests')
      .insert({
        from_user_id: user.id,
        to_user_id: targetUserId,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send friend request.",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Request sent!",
      description: `Friend request sent to ${targetUsername}.`,
    });

    return true;
  };

  const handleConnect = async () => {
    if (!user || !connectCode.trim()) return;
    setConnecting(true);

    try {
      const { data: targetProfile, error: findError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('connection_code', connectCode.toLowerCase().trim())
        .maybeSingle();

      if (findError || !targetProfile) {
        toast({
          title: "Invalid code",
          description: "No user found with this connection code.",
          variant: "destructive",
        });
        setConnecting(false);
        return;
      }

      if (targetProfile.id === user.id) {
        toast({
          title: "Invalid code",
          description: "You can't connect with yourself!",
          variant: "destructive",
        });
        setConnecting(false);
        return;
      }

      // Check if already connected
      const { data: existingConnection } = await supabase
        .from('connections')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetProfile.id}),and(user1_id.eq.${targetProfile.id},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingConnection) {
        toast({
          title: "Already connected",
          description: `You're already connected with ${targetProfile.username}.`,
          variant: "destructive",
        });
        setConnecting(false);
        return;
      }

      // Send friend request instead of direct connection
      const sent = await sendFriendRequest(targetProfile.id, targetProfile.username);
      if (sent) {
        setConnectCode('');
        setDialogOpen(false);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const connectWithUser = async (targetUserId: string, targetUsername: string) => {
    if (!user) return;
    setConnecting(true);

    try {
      if (targetUserId === user.id) {
        toast({
          title: "Invalid",
          description: "You can't connect with yourself!",
          variant: "destructive",
        });
        setConnecting(false);
        return;
      }

      // Check if already connected
      const { data: existingConnection } = await supabase
        .from('connections')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingConnection) {
        toast({
          title: "Already connected",
          description: `You're already connected with ${targetUsername}.`,
          variant: "destructive",
        });
        setConnecting(false);
        return;
      }

      // Send friend request
      const sent = await sendFriendRequest(targetUserId, targetUsername);
      if (sent) {
        setDialogOpen(false);
        setNearbyUsers(prev => prev.filter(u => u.id !== targetUserId));
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const fetchNearbyUsers = async () => {
    if (!user) return;
    setLoadingNearby(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        console.error('No session token');
        setNearbyUsers([]);
        return;
      }

      await supabase.functions.invoke('nearby-users', {
        body: { action: 'register' },
      });

      const { data, error } = await supabase.functions.invoke('nearby-users', {
        body: { action: 'find' },
      });

      if (error) {
        console.error('Error finding nearby users:', error);
        setNearbyUsers([]);
        return;
      }

      console.log('Nearby users response:', data);
      setNearbyUsers(data?.users || []);
    } catch (err) {
      console.error('Error:', err);
      setNearbyUsers([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const registerPresence = async () => {
      try {
        await supabase.functions.invoke('nearby-users', {
          body: { action: 'register' },
        });
      } catch (err) {
        console.error('Failed to register presence:', err);
      }
    };

    registerPresence();
    const interval = setInterval(registerPresence, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (dialogOpen) {
      fetchNearbyUsers();
    }
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
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">LMS Chats</h1>
              <p className="text-xs text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Connection Code Card */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground mb-1">Your Connection Code</h2>
              <p className="text-sm text-muted-foreground">Share this code for others to connect with you</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Hash className="w-5 h-5 text-accent-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-secondary/50 rounded-xl px-5 py-4 font-mono text-xl tracking-[0.3em] text-center text-foreground border border-border/50">
              {profile?.connection_code?.toUpperCase() || '--------'}
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-14 w-14 shrink-0"
              onClick={copyCode}
            >
              {copied ? (
                <Check className="w-5 h-5 text-primary" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="lg">
                <UserPlus className="w-5 h-5" />
                Add Friends
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
                    <div className="py-12 text-center bg-accent/20 rounded-xl">
                      <Wifi className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="font-medium text-muted-foreground">No nearby users</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Users on the same network will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {nearbyUsers.map((nearbyUser) => (
                        <button
                          key={nearbyUser.id}
                          onClick={() => connectWithUser(nearbyUser.id, nearbyUser.username)}
                          className="w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center gap-3 transition-colors"
                          disabled={connecting}
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {nearbyUser.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-foreground">{nearbyUser.username}</span>
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
                      className="h-12 text-center font-mono tracking-widest uppercase bg-secondary/50"
                      maxLength={8}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter your friend's unique 8-digit code to send them a friend request.
                    </p>
                  </div>
                  <Button 
                    onClick={handleConnect} 
                    disabled={connecting || connectCode.length < 8}
                    className="w-full"
                    variant="hero"
                  >
                    {connecting ? 'Sending...' : 'Send Friend Request'}
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <CreateGroupDialog onGroupCreated={fetchGroupChats} />
        </div>

        {/* Group Chats */}
        {groupChats.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground px-1">
              Group Chats ({groupChats.length})
            </h2>
            {groupChats.map((group, index) => (
              <button
                key={group.id}
                onClick={() => navigate(`/group/${group.id}`)}
                className="w-full glass-card rounded-xl p-4 flex items-center gap-4 hover:bg-accent/50 transition-all duration-200 group animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-medium text-foreground truncate">{group.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {group.member_count} members • {group.last_message}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}

        {/* Direct Conversations */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground px-1">
            Direct Messages ({connections.length})
          </h2>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-24" />
                      <div className="h-3 bg-muted rounded w-40" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No connections yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Share your code or enter someone else's to start chatting
              </p>
            </div>
          ) : (
            connections.map((connection, index) => (
              <button
                key={connection.id}
                onClick={() => navigate(`/chat/${connection.id}`)}
                className="w-full glass-card rounded-xl p-4 flex items-center gap-4 hover:bg-accent/50 transition-all duration-200 group animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-semibold text-primary">
                    {connection.other_user?.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {connection.other_user?.username || 'Unknown User'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {connection.last_message || 'No messages yet'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
