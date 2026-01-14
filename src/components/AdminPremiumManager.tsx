import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserProfile {
  id: string;
  username: string;
}

interface PremiumUser {
  id: string;
  user_id: string;
  username: string;
}

export function AdminPremiumManager() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [premiumUsers, setPremiumUsers] = useState<PremiumUser[]>([]);
  const [premiumTagId, setPremiumTagId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch users
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username')
      .order('username');
    setUsers(profilesData || []);

    // Find or create PREMIUM tag
    let { data: premiumTag } = await supabase
      .from('tags')
      .select('id')
      .eq('name', 'PREMIUM')
      .maybeSingle();

    if (!premiumTag) {
      // Create PREMIUM tag if it doesn't exist
      const { data: newTag } = await supabase
        .from('tags')
        .insert({ name: 'PREMIUM', color: '#eab308', is_system: true })
        .select('id')
        .single();
      premiumTag = newTag;
    }

    if (premiumTag) {
      setPremiumTagId(premiumTag.id);
      fetchPremiumUsers(premiumTag.id);
    }
  };

  const fetchPremiumUsers = async (tagId: string) => {
    const { data } = await supabase
      .from('user_tags')
      .select('id, user_id')
      .eq('tag_id', tagId);

    if (data) {
      const userIds = data.map((ut) => ut.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const premiumList = data.map((ut) => ({
        id: ut.id,
        user_id: ut.user_id,
        username: profiles?.find((p) => p.id === ut.user_id)?.username || 'Unknown',
      }));
      setPremiumUsers(premiumList);
    }
  };

  const handleGrantPremium = async () => {
    if (!selectedUserId || !premiumTagId) return;
    setLoading(true);

    // Check if user already has premium
    const existingPremium = premiumUsers.find(pu => pu.user_id === selectedUserId);
    if (existingPremium) {
      toast({
        title: "Already premium",
        description: "This user already has premium.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('user_tags').insert({
      user_id: selectedUserId,
      tag_id: premiumTagId,
      equipped: true,
    });

    if (error) {
      toast({
        title: "Failed to grant premium",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Premium granted!",
        description: "User now has premium access.",
      });
      setSelectedUserId('');
      fetchPremiumUsers(premiumTagId);
    }
    setLoading(false);
  };

  const handleRevokePremium = async (userTagId: string) => {
    const { error } = await supabase.from('user_tags').delete().eq('id', userTagId);

    if (error) {
      toast({
        title: "Failed to revoke premium",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Premium revoked",
      });
      if (premiumTagId) {
        fetchPremiumUsers(premiumTagId);
      }
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
          <Crown className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">Premium Manager</h2>
          <p className="text-sm text-slate-400">Grant or revoke premium access</p>
        </div>
      </div>

      {/* Grant Premium */}
      <div className="space-y-4 mb-6">
        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white flex-1">
              <SelectValue placeholder="Select a user..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-700 border-slate-600">
              {users
                .filter((u) => !premiumUsers.some((pu) => pu.user_id === u.id))
                .map((user) => (
                  <SelectItem key={user.id} value={user.id} className="text-white">
                    {user.username}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleGrantPremium}
            disabled={loading || !selectedUserId}
            className="bg-yellow-600 hover:bg-yellow-500"
          >
            <Plus className="w-4 h-4 mr-1" />
            Grant
          </Button>
        </div>
      </div>

      {/* Premium Users List */}
      <div className="space-y-2">
        <Label className="text-slate-400">Premium Users ({premiumUsers.length})</Label>
        <div className="flex flex-wrap gap-2">
          {premiumUsers.length === 0 ? (
            <p className="text-slate-500 text-sm">No premium users yet</p>
          ) : (
            premiumUsers.map((pu) => (
              <div
                key={pu.id}
                className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1"
              >
                <Crown className="w-3 h-3 text-yellow-500" />
                <span className="text-sm text-white">{pu.username}</span>
                <button
                  onClick={() => handleRevokePremium(pu.id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
