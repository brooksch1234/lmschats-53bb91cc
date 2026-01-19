import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useOnlineStatus() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id);
    };

    // Update immediately
    updateLastSeen();

    // Update every 30 seconds while active
    const interval = setInterval(updateLastSeen, 30 * 1000);

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Update on user activity
    const handleActivity = () => updateLastSeen();
    window.addEventListener('focus', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [user]);
}