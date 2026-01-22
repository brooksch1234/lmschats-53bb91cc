import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Save } from 'lucide-react';

export function ProfileSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchProfile();
    }
  }, [open, user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setDisplayName((data as any).display_name || '');
      setBio((data as any).bio || '');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      } as any)
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Profile updated!',
        description: 'Your changes have been saved.',
      });
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-secondary/50"
            />
            <p className="text-xs text-muted-foreground">
              This is how others will see you (different from username)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Input
              id="bio"
              placeholder="Tell us about yourself"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="bg-secondary/50"
            />
          </div>

          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="w-full gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
