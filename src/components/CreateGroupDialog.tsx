import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Connection {
  id: string;
  other_user_id: string;
  username: string;
}

interface CreateGroupDialogProps {
  onGroupCreated?: () => void;
}

export function CreateGroupDialog({ onGroupCreated }: CreateGroupDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchConnections = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (error) {
      console.error('Error fetching connections:', error);
      setLoading(false);
      return;
    }

    const connList = await Promise.all(
      (data || []).map(async (conn) => {
        const otherUserId = conn.user1_id === user.id ? conn.user2_id : conn.user1_id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', otherUserId)
          .maybeSingle();

        return {
          id: conn.id,
          other_user_id: otherUserId,
          username: profile?.username || 'Unknown',
        };
      })
    );

    setConnections(connList);
    setLoading(false);
  };

  useEffect(() => {
    if (open && user) {
      fetchConnections();
      setGroupName('');
      setSelectedMembers([]);
    }
  }, [open, user]);

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!user || !groupName.trim() || selectedMembers.length === 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a group name and select at least one member.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('group_chats')
        .insert({
          name: groupName.trim(),
          creator_id: user.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add all members (including creator)
      const members = [user.id, ...selectedMembers].map(userId => ({
        group_id: group.id,
        user_id: userId,
      }));

      const { error: membersError } = await supabase
        .from('group_members')
        .insert(members);

      if (membersError) throw membersError;

      toast({
        title: "Group created!",
        description: `${groupName} has been created with ${selectedMembers.length + 1} members.`,
      });

      setOpen(false);
      onGroupCreated?.();
    } catch (err) {
      console.error('Error creating group:', err);
      toast({
        title: "Error",
        description: "Failed to create group.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" size="lg">
          <Users className="w-5 h-5 mr-2" />
          Create Group Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Input
              placeholder="Group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-3">Select members:</p>
            {loading ? (
              <div className="py-4 text-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
              </div>
            ) : connections.length === 0 ? (
              <div className="py-8 text-center bg-accent/20 rounded-xl">
                <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No connections yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {connections.map((conn) => (
                  <label
                    key={conn.other_user_id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMembers.includes(conn.other_user_id)}
                      onCheckedChange={() => toggleMember(conn.other_user_id)}
                    />
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {conn.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">{conn.username}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="hero"
            className="w-full"
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selectedMembers.length === 0}
          >
            {creating ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
