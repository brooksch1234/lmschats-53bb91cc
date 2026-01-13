import { Crown, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PremiumPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
}

export function PremiumPopup({ open, onOpenChange, featureName }: PremiumPopupProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-6 h-6 text-yellow-500" />
            Premium Feature
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-yellow-500" />
            </div>
            
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {featureName} is a Premium Feature
            </h3>
            
            <p className="text-muted-foreground text-sm">
              Upgrade to Premium to unlock this feature and many more exclusive benefits!
            </p>
          </div>

          <div className="space-y-3 bg-secondary/30 rounded-xl p-4">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              Premium Benefits
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Create unlimited group chats
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Access exclusive website themes
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Priority support
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Custom profile badges
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Maybe Later
            </Button>
            <Button
              variant="hero"
              className="flex-1"
              onClick={() => {
                // TODO: Implement premium upgrade flow
                onOpenChange(false);
              }}
            >
              <Crown className="w-4 h-4 mr-2" />
              Get Premium
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
