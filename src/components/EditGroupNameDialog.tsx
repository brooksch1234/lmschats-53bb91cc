import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditGroupNameDialogProps {
  groupId: string;
  currentName: string;
  isCreator: boolean;
  onNameUpdated: (newName: string) => void;
}

export function EditGroupNameDialog({ groupId, currentName, isCreator, onNameUpdated }: EditGroupNameDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!isCreator) return null;

  const handleSave = async () => {
    if (!name.trim() || name.trim() === currentName) {
      setOpen(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('group_chats')
      .update({ name: name.trim() })
      .eq('id', groupId);

    if (error) {
      toast({
        title: 'Failed to update',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      onNameUpdated(name.trim());
      toast({ title: 'Group name updated!' });
      setOpen(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Edit2 className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Group Name</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name"
            maxLength={50}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
