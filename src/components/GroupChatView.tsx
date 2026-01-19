import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Send, Image, Mic, Square, Users, Pin } from 'lucide-react';
import { format } from 'date-fns';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '@/components/TypingIndicator';
import { EditGroupNameDialog } from '@/components/EditGroupNameDialog';
import { PinnedMessages } from '@/components/PinnedMessages';
import { UserTags } from '@/components/UserTags';
import { useMultipleUserTags } from '@/hooks/useUserTags';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageReactions } from '@/components/MessageReactions';
import { CreatePollDialog } from '@/components/CreatePollDialog';
import { PollCard } from '@/components/PollCard';

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  created_at: string;
  is_pinned?: boolean;
  sender?: { username: string };
}

interface GroupInfo {
  id: string;
  name: string;
  creator_id: string;
  member_count?: number;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VOICE_DURATION = 60;

export default function GroupChatView() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [myUsername, setMyUsername] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { typingUsers, handleInputChange, stopTyping } = useTypingIndicator(groupId ? `group:${groupId}` : '', myUsername);

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
    if (user && groupId) {
      fetchGroupAndMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [user, groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchGroupAndMessages = async () => {
    if (!user || !groupId) return;
    setLoading(true);

    const { data: group } = await supabase.from('group_chats').select('*').eq('id', groupId).maybeSingle();
    if (!group) {
      toast({ title: "Error", description: "Group not found.", variant: "destructive" });
      return;
    }

    const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId);
    setGroupInfo({ ...group, member_count: count || 0 });

    const { data: messagesData } = await supabase.from('group_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true });

    const senderIds = [...new Set(messagesData?.map(m => m.sender_id) || [])];
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', senderIds);
    const profileMap = new Map(profiles?.map(p => [p.id, { username: p.username }]) || []);

    const messagesWithSenders = (messagesData || []).map(msg => ({ ...msg, sender: profileMap.get(msg.sender_id) }));
    setMessages(messagesWithSenders);
    setLoading(false);
    await markAsRead();
  };

  const markAsRead = async () => {
    if (!user || !groupId) return;
    const { data: existing } = await supabase.from('message_reads').select('id').eq('user_id', user.id).eq('group_id', groupId).maybeSingle();
    if (existing) {
      await supabase.from('message_reads').update({ last_read_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('message_reads').insert({ user_id: user.id, group_id: groupId });
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel(`group:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const newMsg = payload.new as GroupMessage;
          const { data: profile } = await supabase.from('profiles').select('id, username').eq('id', newMsg.sender_id).maybeSingle();
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: profile || undefined }];
          });
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const updatedMsg = payload.new as GroupMessage;
          setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? { ...m, is_pinned: updatedMsg.is_pinned } : m)));
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleSend = async () => {
    if (!user || !groupId || !newMessage.trim()) return;
    setSending(true);
    stopTyping();
    const { error } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: user.id, content: newMessage.trim(), message_type: 'text' });
    if (error) toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    else setNewMessage('');
    setSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !groupId) return;
    if (file.size > MAX_IMAGE_SIZE) { toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" }); return; }
    setSending(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      await supabase.storage.from('chat-media').upload(fileName, file);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      await supabase.from('group_messages').insert({ group_id: groupId, sender_id: user.id, message_type: 'image', media_url: urlData.publicUrl });
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
    if (!user || !groupId || audioChunksRef.current.length === 0) return;
    setSending(true);
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const fileName = `${user.id}/${Date.now()}-voice.webm`;
      await supabase.storage.from('chat-media').upload(fileName, audioBlob);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      await supabase.from('group_messages').insert({ group_id: groupId, sender_id: user.id, message_type: 'voice', media_url: urlData.publicUrl });
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setSending(false); audioChunksRef.current = []; }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleInputChange();
  };

  const togglePin = async (messageId: string, currentlyPinned: boolean) => {
    const { error } = await supabase.from('group_messages').update({ is_pinned: !currentlyPinned }).eq('id', messageId);
    if (error) toast({ title: 'Failed to update pin', description: error.message, variant: 'destructive' });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const pinnedMessages = messages.filter((m) => m.is_pinned);
  const isCreator = groupInfo?.creator_id === user?.id;
  const senderIds = useMemo(() => [...new Set(messages.map(m => m.sender_id))], [messages]);
  const { tagsMap } = useMultipleUserTags(senderIds);

  const [polls, setPolls] = useState<any[]>([]);

  useEffect(() => {
    if (groupId) fetchPolls();
  }, [groupId]);

  const fetchPolls = async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setPolls(data);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Group Header */}
      <div className="glass-card border-b border-border/50 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-foreground">{groupInfo?.name || 'Loading...'}</h1>
                {groupInfo && (
                  <EditGroupNameDialog
                    groupId={groupInfo.id}
                    currentName={groupInfo.name}
                    isCreator={isCreator}
                    onNameUpdated={(newName) => setGroupInfo({ ...groupInfo, name: newName })}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{groupInfo?.member_count || 0} members</p>
            </div>
          </div>
          {groupId && <CreatePollDialog groupId={groupId} onPollCreated={fetchPolls} />}
        </div>
      </div>

      {/* Active Polls */}
      {polls.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50 space-y-2">
          {polls.slice(0, 2).map(poll => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </div>
      )}

      {/* Pinned Messages */}
      <PinnedMessages messages={pinnedMessages} onUnpin={(id) => togglePin(id, true)} />

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
              const senderTags = tagsMap[message.sender_id] || [];

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex justify-center py-4">
                      <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'glass-card rounded-bl-md'}`}>
                      {!isOwn && message.sender && (
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-medium text-primary">{message.sender.username}</p>
                          <UserTags tags={senderTags} size="sm" />
                        </div>
                      )}
                      {message.message_type === 'text' && <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>}
                      {message.message_type === 'image' && message.media_url && <img src={message.media_url} alt="Shared" className="max-w-full rounded-lg" style={{ maxHeight: '300px' }} />}
                      {message.message_type === 'voice' && message.media_url && <audio controls className="max-w-full"><source src={message.media_url} type="audio/webm" /></audio>}
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{format(new Date(message.created_at), 'h:mm a')}</p>
                        {message.is_pinned && <Pin className="w-3 h-3 text-yellow-500" />}
                        {isCreator && (
                          <button onClick={() => togglePin(message.id, !!message.is_pinned)} className={`text-xs hover:text-yellow-500 ${isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                            {message.is_pinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
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
