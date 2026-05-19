import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { OnlineIndicator } from './OnlineIndicator';
import { UserTags } from './UserTags';
import { useUserTags } from '@/hooks/useUserTags';
import { useAuth } from '@/hooks/useAuth';
import { ReportUserDialog } from './ReportUserDialog';
import { format } from 'date-fns';
import { Calendar, MessageCircle } from 'lucide-react';

interface UserProfileCardProps {
  userId: string;
  trigger: React.ReactNode;
}

interface Profile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  connection_code: string;
}

export function UserProfileCard({ userId, trigger }: UserProfileCardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const { tags } = useUserTags(userId);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProfile();
      fetchMessageCount();
    }
  }, [open, userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (data) setProfile(data);
  };

  const fetchMessageCount = async () => {
    const { count: dmCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId);

    const { count: groupCount } = await supabase
      .from('group_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId);

    setMessageCount((dmCount || 0) + (groupCount || 0));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">User Profile</DialogTitle>
        </DialogHeader>
        
        {profile && (
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                {profile.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.username} 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-primary">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1">
                <OnlineIndicator userId={userId} size="md" />
              </div>
            </div>

            {/* Username & Tags */}
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">{profile.username}</h2>
              <UserTags tags={tags} size="md" />
              <OnlineIndicator userId={userId} showText />
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-sm text-muted-foreground max-w-xs">{profile.bio}</p>
            )}

            {/* Stats */}
            <div className="flex gap-6 pt-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">{messageCount.toLocaleString()} messages</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Joined {format(new Date(profile.created_at), 'MMM yyyy')}</span>
              </div>
            </div>

            {/* Connection Code */}
            <div className="w-full pt-2">
              <div className="bg-secondary/50 rounded-lg px-4 py-2">
                <p className="text-xs text-muted-foreground mb-1">Connection Code</p>
                <p className="font-mono text-sm tracking-wider">{profile.connection_code.toUpperCase()}</p>
              </div>
            </div>

            {/* Report */}
            {user && user.id !== userId && (
              <div className="w-full pt-1">
                <ReportUserDialog reportedUserId={userId} reportedUsername={profile.username} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}