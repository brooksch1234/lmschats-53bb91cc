import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  connection_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface OtherUser {
  id: string;
  username: string;
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && connectionId) {
      fetchConnectionAndMessages();
      setupRealtimeSubscription();
    }
  }, [user, connectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConnectionAndMessages = async () => {
    if (!user || !connectionId) return;
    setLoading(true);

    // Fetch connection to get other user
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();

    if (connError || !connection) {
      toast({
        title: "Error",
        description: "Connection not found.",
        variant: "destructive",
      });
      navigate('/chats');
      return;
    }

    const otherUserId = connection.user1_id === user.id ? connection.user2_id : connection.user1_id;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', otherUserId)
      .maybeSingle();

    setOtherUser(profileData);

    // Fetch messages
    const { data: messagesData, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Error fetching messages:', msgError);
    } else {
      setMessages(messagesData || []);
    }

    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`messages:${connectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `connection_id=eq.${connectionId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSend = async () => {
    if (!user || !connectionId || !newMessage.trim()) return;
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      connection_id: connectionId,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    if (error) {
      toast({
        title: "Failed to send",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewMessage('');
    }

    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chats')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="font-semibold text-primary">
                {otherUser?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h1 className="font-semibold text-foreground">{otherUser?.username || 'Loading...'}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Send a message to start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === user.id;
              const showDate = index === 0 || 
                format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex items-center justify-center py-4">
                      <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-scale-in`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'glass-card rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(message.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message Input */}
      <footer className="glass-card border-t border-border/50 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 h-12 bg-secondary/50 border-border/50"
              disabled={sending}
            />
            <Button 
              variant="hero" 
              size="icon" 
              className="h-12 w-12 shrink-0"
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
