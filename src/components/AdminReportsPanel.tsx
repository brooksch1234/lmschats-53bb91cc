import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Flag, Check, Trash2, Ban } from 'lucide-react';
import { format } from 'date-fns';

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  context: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reporter?: { username: string };
  reported?: { username: string };
}

export function AdminReportsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (filter === 'pending') query = query.eq('status', 'pending');
    const { data } = await query;

    const ids = new Set<string>();
    (data || []).forEach((r) => { ids.add(r.reporter_id); ids.add(r.reported_user_id); });
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', Array.from(ids));
    const map = new Map(profiles?.map((p) => [p.id, p]) || []);

    setReports(
      (data || []).map((r) => ({
        ...r,
        reporter: map.get(r.reporter_id),
        reported: map.get(r.reported_user_id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [filter]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('reports')
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: `Report ${status}` }); fetchReports(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else fetchReports();
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Flag className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">User Reports</h2>
            <p className="text-sm text-slate-400">Review reports submitted by users</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === 'pending' ? 'default' : 'ghost'} onClick={() => setFilter('pending')}>Pending</Button>
          <Button size="sm" variant={filter === 'all' ? 'default' : 'ghost'} onClick={() => setFilter('all')}>All</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : reports.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">No reports</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{r.reporter?.username || '?'}</span>
                  <span className="text-slate-500"> reported </span>
                  <span className="font-semibold text-red-300">{r.reported?.username || '?'}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                  r.status === 'resolved' ? 'bg-green-500/20 text-green-300' :
                  'bg-slate-500/20 text-slate-300'
                }`}>{r.status}</span>
              </div>
              <p className="text-sm text-white mb-1"><span className="text-slate-500">Reason:</span> {r.reason}</p>
              {r.context && <p className="text-sm text-slate-300 mb-2 whitespace-pre-wrap">{r.context}</p>}
              <p className="text-xs text-slate-500 mb-3">{format(new Date(r.created_at), 'MMM d, yyyy · h:mm a')}</p>
              <div className="flex flex-wrap gap-2">
                {r.status === 'pending' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setStatus(r.id, 'resolved')}>
                      <Check className="w-3 h-3" /> Resolve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setStatus(r.id, 'dismissed')}>
                      Dismiss
                    </Button>
                  </>
                )}
                <BanUserDialog
                  userId={r.reported_user_id}
                  username={r.reported?.username}
                  trigger={
                    <Button size="sm" variant="destructive">
                      <Ban className="w-3 h-3" /> Ban user
                    </Button>
                  }
                />
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => remove(r.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reused inside reports panel and bans panel
export function BanUserDialog({
  userId,
  username,
  trigger,
  onBanned,
}: {
  userId: string;
  username?: string;
  trigger: React.ReactNode;
  onBanned?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('permanent');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user || !reason.trim()) return;
    setSubmitting(true);
    let expires_at: string | null = null;
    if (duration !== 'permanent') {
      const hours = parseInt(duration, 10);
      expires_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    }
    const { error } = await supabase.from('user_bans').insert({
      user_id: userId,
      banned_by: user.id,
      reason: reason.trim(),
      expires_at,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Failed to ban', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'User banned' });
      setReason('');
      setOpen(false);
      onBanned?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="glass-card border-border/50">
        <DialogHeader>
          <DialogTitle>Ban {username || 'user'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this user is being banned..." />
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <select
              className="w-full bg-secondary/50 border border-border/50 rounded-md px-3 py-2 text-sm"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="1">1 hour</option>
              <option value="24">1 day</option>
              <option value="168">1 week</option>
              <option value="720">30 days</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || !reason.trim()}>
            {submitting ? 'Banning...' : 'Ban user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Ban {
  id: string;
  user_id: string;
  reason: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  user?: { username: string };
}

export function AdminBansPanel() {
  const { toast } = useToast();
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupCode, setLookupCode] = useState('');

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_bans')
      .select('*')
      .order('created_at', { ascending: false });
    const ids = (data || []).map((b) => b.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', ids);
    const map = new Map(profiles?.map((p) => [p.id, p]) || []);
    setBans((data || []).map((b) => ({ ...b, user: map.get(b.user_id) })));
    setLoading(false);
  };

  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(null);

  useEffect(() => { fetch(); }, []);

  const unban = async (id: string) => {
    const { error } = await supabase.from('user_bans').update({ active: false }).eq('id', id);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'User unbanned' }); fetch(); }
  };

  const banByCode = async () => {
    const code = lookupCode.trim().toLowerCase();
    if (!code) return;
    const { data } = await supabase.from('profiles').select('id, username').eq('connection_code', code).maybeSingle();
    if (!data) {
      toast({ title: 'User not found', description: 'No profile matches that connection code', variant: 'destructive' });
      return;
    }
    setSelectedUser(data);
  };


  const isActive = (b: Ban) => b.active && (!b.expires_at || new Date(b.expires_at) > new Date());

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <Ban className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">User Bans</h2>
          <p className="text-sm text-slate-400">Permanent or temporary bans</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Look up by connection code..."
          value={lookupCode}
          onChange={(e) => setLookupCode(e.target.value)}
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
        />
        <Button onClick={banByCode}>Find</Button>
        {selectedUser && (
          <BanUserDialog
            userId={selectedUser.id}
            username={selectedUser.username}
            trigger={<Button variant="destructive">Ban {selectedUser.username}</Button>}
            onBanned={() => { setSelectedUser(null); setLookupCode(''); fetch(); }}
          />
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : bans.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">No bans</p>
      ) : (
        <div className="space-y-2">
          {bans.map((b) => (
            <div key={b.id} className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white">{b.user?.username || b.user_id.slice(0, 8)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive(b) ? 'bg-red-500/20 text-red-300' : 'bg-slate-500/20 text-slate-400'
                  }`}>
                    {isActive(b) ? (b.expires_at ? 'temp' : 'permanent') : 'inactive'}
                  </span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{b.reason}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {b.expires_at
                    ? `Expires ${format(new Date(b.expires_at), 'MMM d, yyyy · h:mm a')}`
                    : 'Never expires'}
                </p>
              </div>
              {isActive(b) && (
                <Button size="sm" variant="ghost" onClick={() => unban(b.id)}>Unban</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
