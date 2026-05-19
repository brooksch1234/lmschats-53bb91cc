import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface BanInfo {
  reason: string;
  expires_at: string | null;
}

export function useBanCheck() {
  const { user, signOut } = useAuth();
  const [ban, setBan] = useState<BanInfo | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        setBan(null);
        setChecking(false);
        return;
      }
      const { data } = await supabase
        .from('user_bans')
        .select('reason, expires_at, active')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (data && (!data.expires_at || new Date(data.expires_at) > new Date())) {
        setBan({ reason: data.reason, expires_at: data.expires_at });
      } else {
        setBan(null);
      }
      setChecking(false);
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  return { ban, checking, signOut };
}
