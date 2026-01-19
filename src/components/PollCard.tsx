import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';

interface Poll {
  id: string;
  question: string;
  options: string[];
  anonymous: boolean;
  creator_id: string;
  created_at: string;
}

interface PollCardProps {
  poll: Poll;
}

interface Vote {
  option_index: number;
  user_id: string;
}

export function PollCard({ poll }: PollCardProps) {
  const { user } = useAuth();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetchVotes();
    
    const channel = supabase
      .channel(`poll:${poll.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${poll.id}` },
        () => fetchVotes()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [poll.id]);

  const fetchVotes = async () => {
    const { data } = await supabase
      .from('poll_votes')
      .select('option_index, user_id')
      .eq('poll_id', poll.id);
    
    if (data) {
      setVotes(data);
      const mine = data.find(v => v.user_id === user?.id);
      setMyVote(mine ? mine.option_index : null);
    }
  };

  const vote = async (optionIndex: number) => {
    if (!user || voting) return;
    setVoting(true);

    // Remove existing vote if changing
    if (myVote !== null) {
      await supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', poll.id)
        .eq('user_id', user.id);
    }

    // Add new vote
    if (myVote !== optionIndex) {
      await supabase.from('poll_votes').insert({
        poll_id: poll.id,
        user_id: user.id,
        option_index: optionIndex,
      });
    }

    setVoting(false);
  };

  const totalVotes = votes.length;
  const voteCounts = poll.options.map((_, i) => votes.filter(v => v.option_index === i).length);

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <p className="font-medium text-foreground">{poll.question}</p>
      
      <div className="space-y-2">
        {poll.options.map((option, i) => {
          const count = voteCounts[i];
          const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isSelected = myVote === i;

          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={voting}
              className={`w-full text-left rounded-lg p-3 transition-all relative overflow-hidden ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/10' 
                  : 'bg-secondary/30 hover:bg-secondary/50'
              }`}
            >
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                  <span className="text-sm text-foreground">{option}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
              <Progress 
                value={percentage} 
                className="absolute inset-0 h-full rounded-lg opacity-20"
              />
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''} • {poll.anonymous ? 'Anonymous' : 'Public'}
      </p>
    </div>
  );
}