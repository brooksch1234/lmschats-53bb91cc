import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile } from 'lucide-react';

const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😎', label: 'Cool' },
  { emoji: '🤓', label: 'Studying' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🎵', label: 'Vibing' },
  { emoji: '📚', label: 'Busy' },
  { emoji: '🤫', label: 'DND' },
  { emoji: '😤', label: 'Stressed' },
  { emoji: '🎉', label: 'Excited' },
  { emoji: '💭', label: 'Thinking' },
  { emoji: '☕', label: 'Break' },
];

export function MoodSelector() {
  const { user } = useAuth();
  const [mood, setMood] = useState<string | null>(null);
  const [customStatus, setCustomStatus] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) fetchStatus();
  }, [user]);

  const fetchStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_status')
      .select('mood, custom_status')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) {
      setMood(data.mood);
      setCustomStatus(data.custom_status || '');
    }
  };

  const updateMood = async (newMood: string) => {
    if (!user) return;
    
    const { data: existing } = await supabase
      .from('user_status')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_status')
        .update({ mood: newMood, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_status')
        .insert({ user_id: user.id, mood: newMood });
    }
    
    setMood(newMood);
  };

  const updateCustomStatus = async () => {
    if (!user) return;
    
    const { data: existing } = await supabase
      .from('user_status')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_status')
        .update({ custom_status: customStatus, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_status')
        .insert({ user_id: user.id, custom_status: customStatus });
    }
    
    setOpen(false);
  };

  const clearMood = async () => {
    if (!user) return;
    await supabase
      .from('user_status')
      .update({ mood: null, custom_status: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    setMood(null);
    setCustomStatus('');
  };

  const currentMoodEmoji = MOODS.find(m => m.label === mood)?.emoji;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {currentMoodEmoji ? (
            <span className="text-lg">{currentMoodEmoji}</span>
          ) : (
            <Smile className="w-5 h-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">How are you feeling?</p>
            <div className="grid grid-cols-4 gap-2">
              {MOODS.map(m => (
                <button
                  key={m.label}
                  onClick={() => updateMood(m.label)}
                  className={`p-2 rounded-lg text-center hover:bg-secondary transition-colors ${
                    mood === m.label ? 'bg-primary/20 ring-2 ring-primary' : ''
                  }`}
                  title={m.label}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{m.label}</p>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">Custom status</p>
            <div className="flex gap-2">
              <Input
                placeholder="What's up?"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                maxLength={50}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={updateCustomStatus}>Set</Button>
            </div>
          </div>

          {(mood || customStatus) && (
            <Button variant="ghost" size="sm" className="w-full" onClick={clearMood}>
              Clear status
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}