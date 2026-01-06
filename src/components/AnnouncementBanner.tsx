import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Megaphone } from 'lucide-react';
import { Button } from './ui/button';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    fetchLatestAnnouncement();
    setupRealtimeSubscription();
  }, []);

  const fetchLatestAnnouncement = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      // Check if already dismissed
      const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
      if (!dismissedIds.includes(data.id)) {
        setAnnouncement(data);
      }
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('announcements-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
        },
        (payload) => {
          const newAnnouncement = payload.new as Announcement;
          setAnnouncement(newAnnouncement);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleDismiss = () => {
    if (announcement) {
      const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
      dismissedIds.push(announcement.id);
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissedIds));
      setAnnouncement(null);
    }
  };

  if (!announcement) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 animate-slide-up">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">{announcement.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {announcement.content}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {format(new Date(announcement.created_at), 'MMM d, h:mm a')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="shrink-0 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
