import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Check, X, Bell } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';

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

export function FriendRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error);
      setLoading(false);
      return;
    }

    // Fetch sender profiles
    const requestsWithProfiles = await Promise.all(
      (data || []).map(async (req) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', req.from_user_id)
          .maybeSingle();
        
        return {
          ...req,
          from_user: profile || undefined,
        };
      })
    );

    setRequests(requestsWithProfiles);
    setLoading(false);
  };

  useEffect(() => {
    if (open && user) {
      fetchRequests();
    }
  }, [open, user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
          filter: `to_user_id=eq.${user.id}`,
        },
        () => {
          fetchRequests();
          toast({
            title: "New friend request!",
            description: "Someone wants to connect with you.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAccept = async (request: FriendRequest) => {
    if (!user) return;

    // Update request status
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', request.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to accept request.",
        variant: "destructive",
      });
      return;
    }

    // Create connection
    const { error: connError } = await supabase
      .from('connections')
      .insert({
        user1_id: request.from_user_id,
        user2_id: user.id,
      });

    if (connError) {
      toast({
        title: "Error",
        description: "Failed to create connection.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request accepted!",
      description: `You're now connected with ${request.from_user?.username || 'this user'}.`,
    });

    setRequests(prev => prev.filter(r => r.id !== request.id));
  };

  const handleDecline = async (request: FriendRequest) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined' })
      .eq('id', request.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to decline request.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request declined",
    });

    setRequests(prev => prev.filter(r => r.id !== request.id));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {requests.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {requests.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="glass-card border-border/50">
        <SheetHeader>
          <SheetTitle>Friend Requests</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="py-8 text-center">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No pending requests</p>
            </div>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {request.from_user?.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {request.from_user?.username || 'Unknown user'}
                  </p>
                  <p className="text-xs text-muted-foreground">wants to connect</p>
                </div>
                <div className="flex gap-2">
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
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
