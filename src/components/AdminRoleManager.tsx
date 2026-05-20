import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, X } from 'lucide-react';

interface AdminEntry {
  id: string;
  user_id: string;
  username: string;
}

export function AdminRoleManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAdmins = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('id, user_id')
      .eq('role', 'admin');
    if (!data) return;
    const ids = data.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids);
    const map = new Map(profiles?.map((p) => [p.id, p.username]) || []);
    setAdmins(
      data.map((r) => ({ id: r.id, user_id: r.user_id, username: map.get(r.user_id) || 'Unknown' })),
    );
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const grant = async () => {
    const c = code.trim().toLowerCase();
    if (!c) return;
    setLoading(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('connection_code', c)
      .maybeSingle();
    if (!profile) {
      toast({ title: 'User not found', description: 'No user with that connection code', variant: 'destructive' });
      setLoading(false);
      return;
    }
    const { error } = await supabase.from('user_roles').insert({ user_id: profile.id, role: 'admin' });
    setLoading(false);
    if (error) {
      toast({ title: 'Failed to grant admin', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Admin granted', description: `${profile.username} is now an admin.` });
      setCode('');
      fetchAdmins();
    }
  };

  const revoke = async (entry: AdminEntry) => {
    if (entry.user_id === user?.id) {
      toast({ title: "Can't demote yourself", variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('user_roles').delete().eq('id', entry.id);
    if (error) {
      toast({ title: 'Failed to revoke', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Admin revoked' });
      fetchAdmins();
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">Admins</h2>
          <p className="text-sm text-slate-400">Grant or revoke admin access by connection code</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Connection code..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 font-mono"
          maxLength={8}
        />
        <Button onClick={grant} disabled={loading || !code.trim()} className="bg-cyan-600 hover:bg-cyan-500">
          Grant Admin
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {admins.length === 0 ? (
          <p className="text-slate-500 text-sm">No admins yet</p>
        ) : (
          admins.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-1"
            >
              <Shield className="w-3 h-3 text-cyan-400" />
              <span className="text-sm text-white">{a.username}</span>
              {a.user_id !== user?.id && (
                <button onClick={() => revoke(a)} className="text-slate-400 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
