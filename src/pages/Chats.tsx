import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { 
  MessageCircle, 
  Plus, 
  Copy, 
  Check, 
  LogOut, 
  UserPlus,
  ChevronRight,
  Hash,
  Shield
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface Profile {
  id: string;
  username: string;
  connection_code: string;
}

export default function Chats() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [connectCode, setConnectCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchConnections();
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

    // Fetch other user profiles for each connection
    const connectionsWithProfiles = await Promise.all(
      (connectionsData || []).map(async (conn) => {
        const otherUserId = conn.user1_id === user.id ? conn.user2_id : conn.user1_id;
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', otherUserId)
          .maybeSingle();

        // Get last message
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

  const handleConnect = async () => {
    if (!user || !connectCode.trim()) return;
    setConnecting(true);

    try {
      // Find user with this code
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

      // Create connection
      const { error: connectError } = await supabase
        .from('connections')
        .insert({
          user1_id: user.id,
          user2_id: targetProfile.id,
        });

      if (connectError) {
        toast({
          title: "Connection failed",
          description: connectError.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connected!",
          description: `You're now connected with ${targetProfile.username}.`,
        });
        setConnectCode('');
        setDialogOpen(false);
        fetchConnections();
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
              <h1 className="font-semibold text-foreground">Whisper</h1>
              <p className="text-xs text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      {/* Announcement Banner */}
      <AnnouncementBanner />

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

        {/* Add Connection Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" className="w-full" size="lg">
              <UserPlus className="w-5 h-5" />
              Connect with Someone
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Enter Connection Code</DialogTitle>
              <DialogDescription>
                Enter the code shared by the person you want to connect with.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                placeholder="Enter 8-character code"
                value={connectCode}
                onChange={(e) => setConnectCode(e.target.value)}
                className="h-12 text-center font-mono tracking-widest uppercase bg-secondary/50"
                maxLength={8}
              />
              <Button 
                onClick={handleConnect} 
                disabled={connecting || connectCode.length < 8}
                className="w-full"
                variant="hero"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Connections List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground px-1">
            Conversations ({connections.length})
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
