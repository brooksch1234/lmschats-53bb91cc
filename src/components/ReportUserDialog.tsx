import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Flag } from 'lucide-react';

interface ReportUserDialogProps {
  reportedUserId: string;
  reportedUsername?: string;
  trigger?: React.ReactNode;
}

export function ReportUserDialog({ reportedUserId, reportedUsername, trigger }: ReportUserDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason.trim()) return;
    if (user.id === reportedUserId) {
      toast({ title: "You can't report yourself", variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reason: reason.trim(),
      context: context.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Failed to submit report', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Report submitted', description: 'Admins will review it soon.' });
      setReason('');
      setContext('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400">
            <Flag className="w-4 h-4 mr-1" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50">
        <DialogHeader>
          <DialogTitle>Report {reportedUsername || 'user'}</DialogTitle>
          <DialogDescription>
            Submit a report for admin review. Reports are confidential.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="e.g. Harassment, spam, inappropriate content..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="context">Details (optional)</Label>
            <Textarea
              id="context"
              placeholder="Any additional context..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              maxLength={1000}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? 'Submitting...' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
