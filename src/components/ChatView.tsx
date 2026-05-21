import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Send, Image, Mic, Square, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '@/components/TypingIndicator';
import { UserTags } from '@/components/UserTags';
import { useUserTags } from '@/hooks/useUserTags';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageReactions } from '@/components/MessageReactions';
import { OnlineIndicator } from '@/components/OnlineIndicator';
import { UserProfileCard } from '@/components/UserProfileCard';
import { ChatSearch } from '@/components/ChatSearch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
const MAX_MESSAGE_LENGTH = 5000;

export default function ChatView() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { user } = useAuth();
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
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { typingUsers, handleInputChange, stopTyping } = useTypingIndicator(
    connectionId ? `dm:${connectionId}` : '',
    myUsername
  );

  const { tags: otherUserTags } = useUserTags(otherUser?.id);

  const scrollToMessage = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/10');
      setTimeout(() => el.classList.remove('bg-primary/10'), 2000);
    }
  };

  const senderNames: Record<string, string> = {
    ...(user ? { [user.id]: myUsername } : {}),
    ...(otherUser ? { [otherUser.id]: otherUser.username } : {}),
  };

  useEffect(() => {
    const fetchUsername = async () => {
      if (user) {
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
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

    const { data: connection } = await supabase.from('connections').select('*').eq('id', connectionId).maybeSingle();

    if (!connection) {
      toast({ title: "Error", description: "Connection not found.", variant: "destructive" });
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
    const { data: existing } = await supabase.from('message_reads').select('id').eq('user_id', user.id).eq('connection_id', connectionId).maybeSingle();

    if (existing) {
      await supabase.from('message_reads').update({ last_read_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('message_reads').insert({ user_id: user.id, connection_id: connectionId });
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel(`messages:${connectionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          const oldId = (payload.old as { id: string }).id;
          setMessages((prev) => prev.filter(m => m.id !== oldId));
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleSend = async () => {
    if (!user || !connectionId || !newMessage.trim()) return;
    setSending(true);
    stopTyping();
    const { data, error } = await supabase
      .from('messages')
      .insert({ connection_id: connectionId, sender_id: user.id, content: newMessage.trim(), message_type: 'text' })
      .select()
      .single();
    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      setNewMessage('');
      if (data) {
        setMessages((prev) => prev.some(m => m.id === data.id) ? prev : [...prev, data as Message]);
      }
    }
    setSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    setMessages((prev) => prev.filter(m => m.id !== messageId));
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
      fetchConnectionAndMessages();
    }
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

  if (!user) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="glass-card border-b border-border/50 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {otherUser && (
              <UserProfileCard
                userId={otherUser.id}
                trigger={
                  <button className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:ring-2 hover:ring-primary/50 transition-all">
                    <span className="font-semibold text-primary">{otherUser.username.charAt(0).toUpperCase()}</span>
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <OnlineIndicator userId={otherUser.id} />
                    </div>
                  </button>
                }
              />
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-foreground">{otherUser?.username || 'Loading...'}</h1>
                <UserTags tags={otherUserTags} />
              </div>
              {otherUser && <OnlineIndicator userId={otherUser.id} showText />}
            </div>
          </div>
          <ChatSearch 
            messages={messages.filter(m => m.message_type === 'text')} 
            onResultClick={scrollToMessage}
            senderNames={senderNames}
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-6 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No messages yet. Start the conversation!</div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === user.id;
              const showDate = index === 0 || format(new Date(message.created_at), 'yyyy-MM-dd') !== format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');
              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex justify-center py-4">
                      <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div 
                    ref={(el) => { messageRefs.current[message.id] = el; }}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group transition-colors rounded-lg`}
                  >
                    <div className="flex items-end gap-1 max-w-[80%]">
                      {isOwn && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This message will be removed for everyone in this chat. This can't be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteMessage(message.id)} className="bg-red-600 hover:bg-red-500">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <div className={`rounded-2xl px-4 py-3 ${isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'glass-card rounded-bl-md'}`}>
                        {message.message_type === 'text' && <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>}
                        {message.message_type === 'image' && message.media_url && <img src={message.media_url} alt="Shared" className="max-w-full rounded-lg" style={{ maxHeight: '300px' }} />}
                        {message.message_type === 'voice' && message.media_url && <audio controls className="max-w-full"><source src={message.media_url} type="audio/webm" /></audio>}
                        <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{format(new Date(message.created_at), 'h:mm a')}</p>
                        <MessageReactions messageId={message.id} isOwn={isOwn} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && <TypingIndicator typingUsers={typingUsers} />}

      {/* Input Footer */}
      <div className="glass-card border-t border-border/50 px-4 py-3 shrink-0">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        {recording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-3 bg-red-500/10 rounded-xl px-4 py-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-foreground font-mono">{formatTime(recordingTime)}</span>
              <span className="text-muted-foreground text-sm">/ {formatTime(MAX_VOICE_DURATION)}</span>
            </div>
            <Button variant="destructive" size="icon" className="h-10 w-10" onClick={stopRecording}><Square className="w-4 h-4" /></Button>
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
              className="flex-1 h-10 bg-secondary/50 border-border/50" 
              disabled={sending} 
            />
            <Button variant="hero" size="icon" className="h-10 w-10" onClick={handleSend} disabled={sending || !newMessage.trim()}><Send className="w-4 h-4" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
