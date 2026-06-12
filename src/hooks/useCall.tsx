import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePremium } from '@/hooks/usePremium';
import { useToast } from '@/hooks/use-toast';
import { CallDialog } from '@/components/CallDialog';

const COOLDOWN_MS = 10 * 60 * 1000;
const MAX_CALL_SECONDS = 10 * 60;

export type CallType = 'audio' | 'video';

interface ActiveCall {
  callId: string;
  connectionId: string;
  peerId: string;
  peerName: string;
  isCaller: boolean;
  mode: 'outgoing' | 'incoming' | 'active';
  callType: CallType;
}

interface CallContextType {
  startCall: (connectionId: string, peerId: string, peerName: string, callType?: CallType) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

function notifyIncoming(peerName: string, callType: CallType) {
  // Browser notification
  try {
    if ('Notification' in window) {
      const fire = () => new Notification(`${callType === 'video' ? '📹 Video' : '📞 Voice'} call`, {
        body: `${peerName} is calling you`,
        tag: 'lms-incoming-call',
        silent: false,
      });
      if (Notification.permission === 'granted') fire();
      else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => p === 'granted' && fire());
    }
  } catch { /* noop */ }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { toast } = useToast();
  const [active, setActive] = useState<ActiveCall | null>(null);

  // Pre-request notification permission once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      // Lazy ask — only when user is signed in
      if (user) Notification.requestPermission().catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`incoming-calls-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `callee_id=eq.${user.id}` }, async (payload) => {
        const row: any = payload.new;
        if (row.status !== 'ringing') return;
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', row.caller_id).maybeSingle();
        const peerName = profile?.username || 'User';
        const callType: CallType = row.call_type === 'video' ? 'video' : 'audio';
        setActive({
          callId: row.id,
          connectionId: row.connection_id,
          peerId: row.caller_id,
          peerName,
          isCaller: false,
          mode: 'incoming',
          callType,
        });
        notifyIncoming(peerName, callType);
        toast({ title: `Incoming ${callType} call`, description: `${peerName} is calling…` });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, toast]);

  const startCall = useCallback(async (connectionId: string, peerId: string, peerName: string, callType: CallType = 'audio') => {
    if (!user) return;
    if (!isPremium) {
      toast({ title: 'Premium only', description: `${callType === 'video' ? 'Video' : 'Voice'} calling is a premium feature.`, variant: 'destructive' });
      return;
    }
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
      .insert({ connection_id: connectionId, caller_id: user.id, callee_id: peerId, status: 'ringing', call_type: callType } as any)
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
      callType,
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
          callType={active.callType}
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
