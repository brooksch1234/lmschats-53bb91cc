import { useState } from 'react';
import { Palette, Crown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePremium } from '@/hooks/usePremium';
import { PremiumPopup } from './PremiumPopup';

interface Theme {
  id: string;
  name: string;
  isPremium: boolean;
  colors: {
    primary: string;
    background: string;
    accent: string;
  };
}

const themes: Theme[] = [
  {
    id: 'default',
    name: 'Ocean Blue',
    isPremium: false,
    colors: {
      primary: 'hsl(205, 85%, 55%)',
      background: 'hsl(215, 35%, 18%)',
      accent: 'hsl(205, 60%, 25%)',
    },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    isPremium: true,
    colors: {
      primary: 'hsl(270, 70%, 60%)',
      background: 'hsl(270, 30%, 15%)',
      accent: 'hsl(270, 50%, 25%)',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    isPremium: true,
    colors: {
      primary: 'hsl(160, 70%, 45%)',
      background: 'hsl(160, 25%, 12%)',
      accent: 'hsl(160, 45%, 20%)',
    },
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    isPremium: true,
    colors: {
      primary: 'hsl(340, 65%, 55%)',
      background: 'hsl(340, 20%, 15%)',
      accent: 'hsl(340, 40%, 22%)',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    isPremium: true,
    colors: {
      primary: 'hsl(25, 85%, 55%)',
      background: 'hsl(25, 25%, 12%)',
      accent: 'hsl(25, 50%, 20%)',
    },
  },
];

export function ThemeSelector() {
  const { isPremium } = usePremium();
  const [open, setOpen] = useState(false);
  const [premiumPopupOpen, setPremiumPopupOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('default');

  const handleThemeSelect = (theme: Theme) => {
    if (theme.isPremium && !isPremium) {
      setPremiumPopupOpen(true);
      return;
    }
    
    setSelectedTheme(theme.id);
    // TODO: Actually apply the theme by updating CSS variables
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Palette className="w-5 h-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Website Themes
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme)}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  selectedTheme === theme.id 
                    ? 'border-primary' 
                    : 'border-border/50 hover:border-primary/50'
                }`}
              >
                {theme.isPremium && !isPremium && (
                  <div className="absolute top-2 right-2">
                    <Crown className="w-4 h-4 text-yellow-500" />
                  </div>
                )}
                
                {selectedTheme === theme.id && (
                  <div className="absolute top-2 left-2">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
                
                <div className="flex gap-1 mb-3">
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: theme.colors.primary }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: theme.colors.background }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: theme.colors.accent }}
                  />
                </div>
                
                <p className="text-sm font-medium text-foreground text-left">
                  {theme.name}
                </p>
                
                {theme.isPremium && (
                  <p className="text-xs text-yellow-500 text-left mt-1">
                    Premium
                  </p>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      <PremiumPopup 
        open={premiumPopupOpen} 
        onOpenChange={setPremiumPopupOpen}
        featureName="Website Themes"
      />
    </>
  );
}
