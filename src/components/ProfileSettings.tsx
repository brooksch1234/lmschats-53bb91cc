import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Save, Camera, Loader2, Trash2 } from 'lucide-react';

export function ProfileSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [allowUsernameSearch, setAllowUsernameSearch] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) fetchProfile();
  }, [open, user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      setDisplayName((data as any).display_name || '');
      setBio((data as any).bio || '');
      setAllowUsernameSearch((data as any).allow_username_search ?? true);
      setAvatarUrl((data as any).avatar_url || null);
      setUsername((data as any).username || '');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose an image.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Max 5 MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);

      // Moderate image
      try {
        const { data: verdict } = await supabase.functions.invoke('moderate-image', {
          body: { imageUrl: urlData.publicUrl },
        });
        if (verdict && verdict.safe === false) {
          await supabase.storage.from('chat-media').remove([path]);
          toast({ title: 'Image blocked', description: verdict.reason || 'Inappropriate content detected.', variant: 'destructive' });
          return;
        }
      } catch {
        // moderation optional — continue
      }

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl } as any)
        .eq('id', user.id);
      if (updErr) throw updErr;

      setAvatarUrl(urlData.publicUrl);
      toast({ title: 'Profile picture updated!' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message || 'Try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null } as any)
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Error', description: 'Could not remove picture.', variant: 'destructive' });
      return;
    }
    setAvatarUrl(null);
    toast({ title: 'Profile picture removed.' });
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        allow_username_search: allowUsernameSearch,
      } as any)
      .eq('id', user.id);
    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!', description: 'Your changes have been saved.' });
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
      <DialogContent className="glass-card border-border/50 sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-border/50">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-primary">
                    {(username || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Change profile picture"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                className="text-xs text-muted-foreground hover:text-destructive gap-1 h-7"
              >
                <Trash2 className="w-3 h-3" />
                Remove picture
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-secondary/50"
            />
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

          <div className="flex items-start justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-3">
            <div className="flex-1">
              <Label htmlFor="allow-search" className="cursor-pointer">Allow username search</Label>
              <p className="text-xs text-muted-foreground mt-1">
                When off, others can only add you with your connection code.
              </p>
            </div>
            <Switch
              id="allow-search"
              checked={allowUsernameSearch}
              onCheckedChange={setAllowUsernameSearch}
            />
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full gap-2">
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
