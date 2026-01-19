import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BarChart3, Plus, X } from 'lucide-react';

interface CreatePollDialogProps {
  groupId: string;
  onPollCreated?: () => void;
}

export function CreatePollDialog({ groupId, onPollCreated }: CreatePollDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [anonymous, setAnonymous] = useState(false);
  const [creating, setCreating] = useState(false);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const createPoll = async () => {
    if (!user || !question.trim()) return;
    
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast({ title: "Need at least 2 options", variant: "destructive" });
      return;
    }

    setCreating(true);
    
    const { error } = await supabase.from('polls').insert({
      group_id: groupId,
      creator_id: user.id,
      question: question.trim(),
      options: validOptions,
      anonymous,
    });

    if (error) {
      toast({ title: "Failed to create poll", variant: "destructive" });
    } else {
      toast({ title: "Poll created!" });
      setOpen(false);
      setQuestion('');
      setOptions(['', '']);
      setAnonymous(false);
      onPollCreated?.();
    }
    
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Create Poll">
          <BarChart3 className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Create Poll
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          <div>
            <Label>Question</Label>
            <Input
              placeholder="What do you want to ask?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((option, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Option ${i + 1}`}
                  value={option}
                  onChange={(e) => updateOption(i, e.target.value)}
                  maxLength={100}
                />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => removeOption(i)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <Button variant="outline" size="sm" onClick={addOption} className="w-full gap-2">
                <Plus className="w-4 h-4" /> Add Option
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="anonymous">Anonymous voting</Label>
            <Switch id="anonymous" checked={anonymous} onCheckedChange={setAnonymous} />
          </div>

          <Button 
            onClick={createPoll} 
            disabled={creating || !question.trim() || options.filter(o => o.trim()).length < 2}
            className="w-full"
            variant="hero"
          >
            {creating ? 'Creating...' : 'Create Poll'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}