import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
}

interface ChatSearchProps {
  messages: Message[];
  onResultClick: (messageId: string) => void;
  senderNames: Record<string, string>;
}

export function ChatSearch({ messages, onResultClick, senderNames }: ChatSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = query.trim()
    ? messages.filter(m => 
        m.content.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : [];

  const handleResultClick = (messageId: string) => {
    onResultClick(messageId);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(true)}
        className="shrink-0"
      >
        <Search className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="relative flex-1 max-w-xs">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-8 bg-secondary/50"
            autoFocus
          />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          onClick={() => { setIsOpen(false); setQuery(''); }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No messages found
            </div>
          ) : (
            results.map(msg => (
              <button
                key={msg.id}
                onClick={() => handleResultClick(msg.id)}
                className="w-full p-3 text-left hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-primary">
                    {senderNames[msg.sender_id] || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">
                  {msg.content}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}