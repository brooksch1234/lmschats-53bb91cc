import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Megaphone, 
  Users, 
  MessageSquare, 
  Link2,
  Send,
  Trash2,
  Shield,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';

interface Stats {
  totalUsers: number;
  totalConnections: number;
  totalMessages: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalConnections: 0, totalMessages: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    if (!adminLoading && !isAdmin && user) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      navigate('/chats');
    }
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchAnnouncements();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    setLoading(true);
    
    // Fetch user count
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch connection count
    const { count: connectionCount } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true });

    // Fetch message count
    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    setStats({
      totalUsers: userCount || 0,
      totalConnections: connectionCount || 0,
      totalMessages: messageCount || 0,
    });
    
    setLoading(false);
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
    } else {
      setAnnouncements(data || []);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!user || !newTitle.trim() || !newContent.trim()) return;
    setPosting(true);

    const { error } = await supabase.from('announcements').insert({
      author_id: user.id,
      title: newTitle.trim(),
      content: newContent.trim(),
    });

    if (error) {
      toast({
        title: "Failed to post",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Announcement posted!",
        description: "All users will see this announcement.",
      });
      setNewTitle('');
      setNewContent('');
      fetchAnnouncements();
    }

    setPosting(false);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);

    if (error) {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Announcement deleted",
      });
      fetchAnnouncements();
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/90 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chats')} className="text-slate-300 hover:bg-slate-700 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-semibold text-white">Admin Dashboard</h1>
              <p className="text-xs text-slate-400">LMS Chats · Developer Tools</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
          <StatCard
            icon={<Users className="w-6 h-6" />}
            label="Total Users"
            value={stats.totalUsers}
            loading={loading}
          />
          <StatCard
            icon={<Link2 className="w-6 h-6" />}
            label="Connections"
            value={stats.totalConnections}
            loading={loading}
          />
          <StatCard
            icon={<MessageSquare className="w-6 h-6" />}
            label="Messages Sent"
            value={stats.totalMessages}
            loading={loading}
          />
        </div>

        {/* Create Announcement */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">New Announcement</h2>
              <p className="text-sm text-slate-400">Broadcast to all users</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-slate-300">Title</Label>
              <Input
                id="title"
                placeholder="Announcement title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content" className="text-slate-300">Message</Label>
              <Textarea
                id="content"
                placeholder="Write your announcement..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 min-h-[100px]"
              />
            </div>
            <Button 
              onClick={handlePostAnnouncement}
              disabled={posting || !newTitle.trim() || !newContent.trim()}
              className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {posting ? 'Posting...' : (
                <>
                  <Send className="w-4 h-4" />
                  Post Announcement
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-medium text-slate-400">
              Previous Announcements ({announcements.length})
            </h2>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 text-center">
              <p className="text-slate-400">No announcements yet</p>
            </div>
          ) : (
            announcements.map((announcement, index) => (
              <div
                key={announcement.id}
                className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white mb-1">{announcement.title}</h3>
                    <p className="text-sm text-slate-300 mb-3 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(announcement.created_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  loading 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  loading: boolean;
}) {
  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
          {icon}
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-slate-700 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      )}
    </div>
  );
}
