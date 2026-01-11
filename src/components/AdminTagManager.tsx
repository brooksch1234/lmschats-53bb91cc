import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, Trash2, UserPlus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TagData {
  id: string;
  name: string;
  color: string;
  is_system: boolean;
}

interface UserProfile {
  id: string;
  username: string;
}

interface UserTagAssignment {
  id: string;
  user_id: string;
  username: string;
}

export function AdminTagManager() {
  const [tags, setTags] = useState<TagData[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [selectedTag, setSelectedTag] = useState<TagData | null>(null);
  const [tagUsers, setTagUsers] = useState<UserTagAssignment[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const { toast } = useToast();

  const colors = [
    '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  ];

  useEffect(() => {
    fetchTags();
    fetchUsers();
  }, []);

  const fetchTags = async () => {
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name');
    setTags(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, username').order('username');
    setUsers(data || []);
  };

  const fetchTagUsers = async (tagId: string) => {
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

      const assignments = data.map((ut) => ({
        id: ut.id,
        user_id: ut.user_id,
        username: profiles?.find((p) => p.id === ut.user_id)?.username || 'Unknown',
      }));
      setTagUsers(assignments);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setLoading(true);

    const { error } = await supabase.from('tags').insert({
      name: newTagName.trim().toUpperCase(),
      color: newTagColor,
    });

    if (error) {
      toast({ title: 'Failed to create tag', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tag created!' });
      setNewTagName('');
      fetchTags();
    }
    setLoading(false);
  };

  const handleDeleteTag = async (tagId: string) => {
    const { error } = await supabase.from('tags').delete().eq('id', tagId);
    if (error) {
      toast({ title: 'Failed to delete tag', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tag deleted!' });
      fetchTags();
    }
  };

  const handleAssignTag = async () => {
    if (!selectedTag || !selectedUserId) return;
    setLoading(true);

    const { error } = await supabase.from('user_tags').insert({
      user_id: selectedUserId,
      tag_id: selectedTag.id,
    });

    if (error) {
      toast({ title: 'Failed to assign tag', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tag assigned!' });
      setSelectedUserId('');
      fetchTagUsers(selectedTag.id);
    }
    setLoading(false);
  };

  const handleRemoveUserTag = async (userTagId: string) => {
    const { error } = await supabase.from('user_tags').delete().eq('id', userTagId);
    if (error) {
      toast({ title: 'Failed to remove tag', description: error.message, variant: 'destructive' });
    } else {
      if (selectedTag) fetchTagUsers(selectedTag.id);
    }
  };

  const openAssignDialog = (tag: TagData) => {
    setSelectedTag(tag);
    fetchTagUsers(tag.id);
    setAssignDialogOpen(true);
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Tag className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">Tag Manager</h2>
          <p className="text-sm text-slate-400">Create and assign user tags</p>
        </div>
      </div>

      {/* Create new tag */}
      <div className="space-y-4 mb-6">
        <div className="flex gap-2">
          <Input
            placeholder="New tag name..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value.toUpperCase())}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
            maxLength={20}
          />
          <div className="flex gap-1">
            {colors.slice(0, 5).map((color) => (
              <button
                key={color}
                onClick={() => setNewTagColor(color)}
                className={`w-8 h-8 rounded-md transition-transform hover:scale-110 ${
                  newTagColor === color ? 'ring-2 ring-white' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Button
            onClick={handleCreateTag}
            disabled={loading || !newTagName.trim()}
            className="bg-purple-600 hover:bg-purple-500"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Existing tags */}
      <div className="space-y-2">
        <Label className="text-slate-400">Existing Tags</Label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1 bg-slate-700/50 rounded-lg px-2 py-1"
            >
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-white"
                onClick={() => openAssignDialog(tag)}
              >
                <UserPlus className="w-3 h-3" />
              </Button>
              {!tag.is_system && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-400 hover:text-red-300"
                  onClick={() => handleDeleteTag(tag.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Assign tag dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              Assign
              {selectedTag && (
                <Badge
                  style={{
                    backgroundColor: `${selectedTag.color}20`,
                    color: selectedTag.color,
                  }}
                >
                  {selectedTag.name}
                </Badge>
              )}
              to users
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {users
                    .filter((u) => !tagUsers.some((tu) => tu.user_id === u.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id} className="text-white">
                        {user.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAssignTag}
                disabled={loading || !selectedUserId}
                className="bg-purple-600 hover:bg-purple-500"
              >
                Assign
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-400">Users with this tag:</Label>
              <div className="flex flex-wrap gap-2">
                {tagUsers.length === 0 ? (
                  <p className="text-slate-500 text-sm">No users assigned</p>
                ) : (
                  tagUsers.map((tu) => (
                    <div
                      key={tu.id}
                      className="flex items-center gap-1 bg-slate-700 rounded-full px-3 py-1"
                    >
                      <span className="text-sm text-white">{tu.username}</span>
                      <button
                        onClick={() => handleRemoveUserTag(tu.id)}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
