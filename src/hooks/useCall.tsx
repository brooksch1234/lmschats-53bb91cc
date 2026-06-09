import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePremium } from '@/hooks/usePremium';
import { useToast } from '@/hooks/use-toast';
import { CallDialog } from '@/components/CallDialog';

const COOLDOWN_MS = 10 * 60 * 1000;
const MAX_CALL_SECONDS = 10 * 60;

interface ActiveCall {
  callId: string;
  connectionId: string;
  peerId: string;
  peerName: string;
  isCaller: boolean;
  mode: 'outgoing' | 'incoming' | 'active';
}

interface CallContextType {
  startCall: (connectionId: string, peerId: string, peerName: string) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { toast } = useToast();
  const [active, setActive] = useState<ActiveCall | null>(null);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`incoming-calls-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `callee_id=eq.${user.id}` }, async (payload) => {
        const row: any = payload.new;
        if (row.status !== 'ringing') return;
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', row.caller_id).maybeSingle();
        setActive({
          callId: row.id,
          connectionId: row.connection_id,
          peerId: row.caller_id,
          peerName: profile?.username || 'User',
          isCaller: false,
          mode: 'incoming',
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const startCall = useCallback(async (connectionId: string, peerId: string, peerName: string) => {
    if (!user) return;
    if (!isPremium) {
      toast({ title: 'Premium only', description: 'Voice calling is a premium feature.', variant: 'destructive' });
      return;
    }
    // Cooldown check: any call between this pair in the last 10 min
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { data: recent } = await supabase
      .from('call_sessions')
      .select('ended_at, status')
      .eq('connection_id', connectionId)
      .not('ended_at', 'is', null)
      .gte('ended_at', since)
      .order('ended_at', { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      const last = new Date(recent[0].ended_at!).getTime();
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 60000);
      toast({ title: 'Cooldown active', description: `You can call this person again in ~${remaining} min.`, variant: 'destructive' });
      return;
    }
    const { data: inserted, error } = await supabase
      .from('call_sessions')
      .insert({ connection_id: connectionId, caller_id: user.id, callee_id: peerId, status: 'ringing' })
      .select()
      .single();
    if (error || !inserted) {
      toast({ title: 'Could not start call', description: error?.message, variant: 'destructive' });
      return;
    }
    setActive({
      callId: inserted.id,
      connectionId,
      peerId,
      peerName,
      isCaller: true,
      mode: 'outgoing',
    });
  }, [user, isPremium, toast]);

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}
      {active && (
        <CallDialog
          open
          onClose={() => setActive(null)}
          mode={active.mode}
          callId={active.callId}
          connectionId={active.connectionId}
          peerId={active.peerId}
          peerName={active.peerName}
          isCaller={active.isCaller}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

export { MAX_CALL_SECONDS };
