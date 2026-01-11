import { useState } from 'react';
import { Pin, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface PinnedMessage {
  id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  sender?: { username: string };
}

interface PinnedMessagesProps {
  messages: PinnedMessage[];
  onUnpin: (messageId: string) => void;
}

export function PinnedMessages({ messages, onUnpin }: PinnedMessagesProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  return (
    <div className="bg-primary/5 border-b border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2 text-primary">
          <Pin className="w-4 h-4" />
          <span className="font-medium">{messages.length} pinned message{messages.length > 1 ? 's' : ''}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background/50">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {msg.sender?.username || 'Unknown'} • {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                </p>
                {msg.message_type === 'text' && (
                  <p className="text-sm truncate">{msg.content}</p>
                )}
                {msg.message_type === 'image' && (
                  <p className="text-sm text-muted-foreground italic">📷 Image</p>
                )}
                {msg.message_type === 'voice' && (
                  <p className="text-sm text-muted-foreground italic">🎤 Voice message</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onUnpin(msg.id)}
              >
                <Pin className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
