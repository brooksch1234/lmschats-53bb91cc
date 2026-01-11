import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const BETA_END_DATE = new Date('2025-02-01');
const POPUP_SHOWN_KEY = 'beta_tag_popup_shown';

export function BetaTagPopup() {
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#8b5cf6');
  const { user } = useAuth();
  const { toast } = useToast();

  const colors = [
    '#8b5cf6', // Purple
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
  ];

  useEffect(() => {
    const checkAndShowPopup = async () => {
      if (!user) return;

      // Check if beta period is still active
      if (new Date() > BETA_END_DATE) return;

      // Check if popup was already shown
      const shown = localStorage.getItem(`${POPUP_SHOWN_KEY}_${user.id}`);
      if (shown) return;

      // Check if user already has beta tag
      const { data: betaTag } = await supabase
        .from('tags')
        .select('id')
        .eq('name', 'BETA')
        .maybeSingle();

      if (!betaTag) return;

      const { data: existingTag } = await supabase
        .from('user_tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('tag_id', betaTag.id)
        .maybeSingle();

      if (existingTag) {
        localStorage.setItem(`${POPUP_SHOWN_KEY}_${user.id}`, 'true');
        return;
      }

      setOpen(true);
    };

    checkAndShowPopup();
  }, [user]);

  const handleClaim = async () => {
    if (!user) return;
    setClaiming(true);

    try {
      // Get beta tag id
      const { data: betaTag } = await supabase
        .from('tags')
        .select('id')
        .eq('name', 'BETA')
        .single();

      if (!betaTag) throw new Error('Beta tag not found');

      // Insert user tag with custom color
      const { error } = await supabase.from('user_tags').insert({
        user_id: user.id,
        tag_id: betaTag.id,
        custom_color: selectedColor,
      });

      if (error) throw error;

      toast({
        title: '🎉 BETA tag claimed!',
        description: 'Your new tag is now visible to others.',
      });

      localStorage.setItem(`${POPUP_SHOWN_KEY}_${user.id}`, 'true');
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Failed to claim tag',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleSkip = () => {
    if (user) {
      localStorage.setItem(`${POPUP_SHOWN_KEY}_${user.id}`, 'true');
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Welcome Beta Tester!
          </DialogTitle>
          <DialogDescription>
            Thanks for being an early user! Claim your exclusive BETA tag that others will see when chatting with you.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Preview */}
          <div className="flex items-center justify-center">
            <Badge
              variant="secondary"
              className="text-sm px-3 py-1"
              style={{
                backgroundColor: `${selectedColor}20`,
                color: selectedColor,
                borderColor: `${selectedColor}40`,
              }}
            >
              BETA
            </Badge>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">Choose your tag color:</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleSkip}>
              Maybe Later
            </Button>
            <Button className="flex-1" onClick={handleClaim} disabled={claiming}>
              {claiming ? 'Claiming...' : 'Claim Tag'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Available until February 1st, 2025
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
