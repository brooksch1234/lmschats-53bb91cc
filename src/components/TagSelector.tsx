import { useState, useEffect } from 'react';
import { Tag, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UserTag {
  id: string;
  tag_id: string;
  equipped: boolean;
  custom_color: string | null;
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

export function TagSelector() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUserTags = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('user_tags')
      .select(`
        id,
        tag_id,
        equipped,
        custom_color,
        tags!inner(id, name, color)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user tags:', error);
    } else {
      const formattedTags = (data || []).map((ut: any) => ({
        id: ut.id,
        tag_id: ut.tag_id,
        equipped: ut.equipped,
        custom_color: ut.custom_color,
        tag: ut.tags,
      }));
      setUserTags(formattedTags);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && user) {
      fetchUserTags();
    }
  }, [open, user]);

  const toggleTag = async (userTagId: string, currentEquipped: boolean) => {
    const { error } = await supabase
      .from('user_tags')
      .update({ equipped: !currentEquipped })
      .eq('id', userTagId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update tag",
        variant: "destructive",
      });
    } else {
      setUserTags(prev => 
        prev.map(ut => 
          ut.id === userTagId ? { ...ut, equipped: !currentEquipped } : ut
        )
      );
    }
  };

  const equippedCount = userTags.filter(t => t.equipped).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Tag className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            My Tags
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Select which tags to display on your profile. ({equippedCount} equipped)
          </p>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading your tags...
            </div>
          ) : userTags.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              You don't have any tags yet.
            </div>
          ) : (
            <div className="space-y-2">
              {userTags.map((userTag) => (
                <button
                  key={userTag.id}
                  onClick={() => toggleTag(userTag.id, userTag.equipped)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                    userTag.equipped 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border/50 hover:border-primary/50'
                  }`}
                >
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: `${userTag.custom_color || userTag.tag.color}20`,
                      color: userTag.custom_color || userTag.tag.color,
                    }}
                  >
                    {userTag.tag.name}
                  </Badge>
                  
                  {userTag.equipped && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
