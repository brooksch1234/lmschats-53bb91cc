import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const MAX_CALL_SECONDS = 10 * 60;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

type Mode = 'outgoing' | 'incoming' | 'active';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  callId: string;
  connectionId: string;
  peerId: string;
  peerName: string;
  isCaller: boolean;
}

export function CallDialog({ open, onClose, mode: initialMode, callId, connectionId, peerId, peerName, isCaller }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  // Signaling channel (broadcast)
  useEffect(() => {
    if (!open || !user) return;
    const ch = supabase.channel(`call-${callId}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (payload.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ch.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', sdp: answer, from: user.id } });
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === 'ice' && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (e) { console.error('signal err', e); }
    });

    ch.on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${callId}` }, (payload: any) => {
      const row = payload.new;
      if (row.status === 'ended' || row.status === 'declined') endCall(false);
      if (row.status === 'active' && mode !== 'active') startActive();
    });

    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, callId, user?.id]);

  const setupPeer = async () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.ontrack = (e) => { if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (e) => {
      if (e.candidate && channelRef.current) {
        channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { type: 'ice', candidate: e.candidate, from: user!.id } });
      }
    };
    return pc;
  };

  const startActive = async () => {
    if (mode === 'active') return;
    setMode('active');
    if (timerRef.current) clearInterval(timerRef.current);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev + 1 >= MAX_CALL_SECONDS) { endCall(true); return prev; }
        return prev + 1;
      });
    }, 1000);
  };

  // Caller: when callee accepts (status=active), create offer
  useEffect(() => {
    if (mode === 'active' && isCaller && pcRef.current && pcRef.current.signalingState === 'stable' && !pcRef.current.localDescription) {
      (async () => {
        const pc = pcRef.current!;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', sdp: offer, from: user!.id } });
      })();
    }
  }, [mode, isCaller]);

  // For outgoing caller — set up peer immediately so ICE is ready
  useEffect(() => {
    if (open && isCaller && !pcRef.current) {
      setupPeer().catch(() => { toast({ title: 'Microphone access denied', variant: 'destructive' }); endCall(true); });
    }
  }, [open, isCaller]);

  const acceptCall = async () => {
    try {
      await setupPeer();
      await supabase.from('call_sessions').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', callId);
      startActive();
    } catch {
      toast({ title: 'Microphone access denied', variant: 'destructive' });
      declineCall();
    }
  };

  const declineCall = async () => {
    await supabase.from('call_sessions').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', callId);
    cleanup();
    onClose();
  };

  const endCall = async (notify: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (notify) {
      await supabase.from('call_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
    }
    cleanup();
    onClose();
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach(t => t.enabled = !t.enabled);
    setMuted(m => !m);
  };

  const fmt = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) endCall(true); }}>
      <DialogContent className="glass-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            {mode === 'incoming' ? 'Incoming call' : mode === 'outgoing' ? 'Calling...' : 'In call'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl font-semibold text-primary">{peerName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="text-lg font-medium">{peerName}</div>
          {mode === 'active' && (
            <div className="font-mono text-muted-foreground">{fmt(seconds)} / {fmt(MAX_CALL_SECONDS)}</div>
          )}
          <audio ref={remoteAudioRef} autoPlay />
          <div className="flex gap-4">
            {mode === 'incoming' && (
              <>
                <Button variant="destructive" size="icon" className="h-14 w-14 rounded-full" onClick={declineCall}>
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700" onClick={acceptCall}>
                  <Phone className="w-6 h-6" />
                </Button>
              </>
            )}
            {mode !== 'incoming' && (
              <>
                {mode === 'active' && (
                  <Button variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={toggleMute}>
                    {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                )}
                <Button variant="destructive" size="icon" className="h-14 w-14 rounded-full" onClick={() => endCall(true)}>
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
