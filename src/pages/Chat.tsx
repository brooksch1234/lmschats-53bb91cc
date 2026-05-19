import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Image, Mic, Square } from 'lucide-react';
import { format } from 'date-fns';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '@/components/TypingIndicator';
import { UserTags } from '@/components/UserTags';
import { useUserTags } from '@/hooks/useUserTags';

interface Message {
  id: string;
  connection_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  media_url: string | null;
  created_at: string;
}

interface OtherUser {
  id: string;
  username: string;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VOICE_DURATION = 60;

export default function Chat() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [myUsername, setMyUsername] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { typingUsers, handleInputChange, stopTyping } = useTypingIndicator(
    connectionId ? `dm:${connectionId}` : '',
    myUsername
  );

  const { tags: otherUserTags } = useUserTags(otherUser?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchUsername = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        setMyUsername(data?.username || 'User');
      }
    };
    fetchUsername();
  }, [user]);

  useEffect(() => {
    if (user && connectionId) {
      fetchConnectionAndMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [user, connectionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConnectionAndMessages = async () => {
    if (!user || !connectionId) return;
    setLoading(true);

    const { data: connection, error: connError } = await supabase
      .from('connections').select('*').eq('id', connectionId).maybeSingle();

    if (connError || !connection) {
      toast({ title: "Error", description: "Connection not found.", variant: "destructive" });
      navigate('/chats');
      return;
    }

    const otherUserId = connection.user1_id === user.id ? connection.user2_id : connection.user1_id;
    const { data: profileData } = await supabase.from('profiles').select('id, username').eq('id', otherUserId).maybeSingle();
    
    setOtherUser(profileData || null);

    const { data: messagesData } = await supabase.from('messages').select('*').eq('connection_id', connectionId).order('created_at', { ascending: true });
    setMessages(messagesData || []);
    setLoading(false);

    await markAsRead();
  };

  const markAsRead = async () => {
    if (!user || !connectionId) return;
    
    const { data: existing } = await supabase
      .from('message_reads')
      .select('id')
      .eq('user_id', user.id)
      .eq('connection_id', connectionId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('message_reads')
        .update({ last_read_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('message_reads')
        .insert({ user_id: user.id, connection_id: connectionId });
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel(`messages:${connectionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleSend = async () => {
    if (!user || !connectionId || !newMessage.trim()) return;
    setSending(true);
    stopTyping();
    const { error } = await supabase.from('messages').insert({ connection_id: connectionId, sender_id: user.id, content: newMessage.trim(), message_type: 'text' });
    if (error) toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    else setNewMessage('');
    setSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !connectionId) return;
    if (file.size > MAX_IMAGE_SIZE) { toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" }); return; }
    setSending(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      await supabase.storage.from('chat-media').upload(fileName, file);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      await supabase.from('messages').insert({ connection_id: connectionId, sender_id: user.id, content: '', message_type: 'image', media_url: urlData.publicUrl });
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setSending(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => { stream.getTracks().forEach(t => t.stop()); await sendVoiceMessage(); };
      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => { if (prev >= MAX_VOICE_DURATION - 1) { stopRecording(); return prev; } return prev + 1; });
      }, 1000);
    } catch { toast({ title: "Microphone access denied", variant: "destructive" }); }
  };

  const stopRecording = () => {
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    if (mediaRecorderRef.current && recording) { mediaRecorderRef.current.stop(); setRecording(false); }
  };

  const sendVoiceMessage = async () => {
    if (!user || !connectionId || audioChunksRef.current.length === 0) return;
    setSending(true);
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const fileName = `${user.id}/${Date.now()}-voice.webm`;
      await supabase.storage.from('chat-media').upload(fileName, audioBlob);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      await supabase.from('messages').insert({ connection_id: connectionId, sender_id: user.id, content: '', message_type: 'voice', media_url: urlData.publicUrl });
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setSending(false); audioChunksRef.current = []; }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleInputChange();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (authLoading || !user) return <div className="min-h-screen gradient-bg flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <header className="glass-card border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chats')}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="font-semibold text-primary">{otherUser?.username?.charAt(0).toUpperCase() || '?'}</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-foreground">{otherUser?.username || 'Loading...'}</h1>
                <UserTags tags={otherUserTags} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {loading ? <div className="text-center py-12 text-muted-foreground">Loading messages...</div> : messages.length === 0 ? <div className="text-center py-12 text-muted-foreground">No messages yet</div> : messages.map((message, index) => {
            const isOwn = message.sender_id === user.id;
            const showDate = index === 0 || format(new Date(message.created_at), 'yyyy-MM-dd') !== format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');
            return (
              <div key={message.id}>
                {showDate && <div className="flex justify-center py-4"><span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">{format(new Date(message.created_at), 'MMMM d, yyyy')}</span></div>}
                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'glass-card rounded-bl-md'}`}>
                    {message.message_type === 'text' && <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>}
                    {message.message_type === 'image' && message.media_url && <img src={message.media_url} alt="Shared" className="max-w-full rounded-lg" style={{ maxHeight: '300px' }} />}
                    {message.message_type === 'voice' && message.media_url && <audio controls className="max-w-full"><source src={message.media_url} type="audio/webm" /></audio>}
                    <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{format(new Date(message.created_at), 'h:mm a')}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="max-w-2xl mx-auto w-full">
          <TypingIndicator typingUsers={typingUsers} />
        </div>
      )}

      <footer className="glass-card border-t border-border/50 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          {recording ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3 bg-red-500/10 rounded-xl px-4 py-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-foreground font-mono">{formatTime(recordingTime)}</span>
                <span className="text-muted-foreground text-sm">/ {formatTime(MAX_VOICE_DURATION)}</span>
              </div>
              <Button variant="destructive" size="icon" className="h-12 w-12" onClick={stopRecording}><Square className="w-5 h-5" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={sending}><Image className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" onClick={startRecording} disabled={sending}><Mic className="w-5 h-5" /></Button>
              <Input 
                placeholder="Type a message..." 
                value={newMessage} 
                onChange={handleMessageInputChange} 
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                className="flex-1 h-12 bg-secondary/50 border-border/50" 
                disabled={sending} 
              />
              <Button variant="hero" size="icon" className="h-12 w-12" onClick={handleSend} disabled={sending || !newMessage.trim()}><Send className="w-5 h-5" /></Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
