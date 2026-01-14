import { useState, useEffect } from 'react';
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
    foreground: string;
    card: string;
  };
}

const themes: Theme[] = [
  {
    id: 'default',
    name: 'Ocean Blue',
    isPremium: false,
    colors: {
      primary: '205 85% 55%',
      background: '215 35% 18%',
      accent: '205 60% 25%',
      foreground: '210 20% 95%',
      card: '215 32% 22%',
    },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    isPremium: true,
    colors: {
      primary: '270 70% 60%',
      background: '270 30% 15%',
      accent: '270 50% 25%',
      foreground: '270 20% 95%',
      card: '270 28% 20%',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    isPremium: true,
    colors: {
      primary: '160 70% 45%',
      background: '160 25% 12%',
      accent: '160 45% 20%',
      foreground: '160 20% 95%',
      card: '160 22% 18%',
    },
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    isPremium: true,
    colors: {
      primary: '340 65% 55%',
      background: '340 20% 15%',
      accent: '340 40% 22%',
      foreground: '340 20% 95%',
      card: '340 18% 20%',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    isPremium: true,
    colors: {
      primary: '25 85% 55%',
      background: '25 25% 12%',
      accent: '25 50% 20%',
      foreground: '25 20% 95%',
      card: '25 22% 18%',
    },
  },
];

const THEME_STORAGE_KEY = 'lms-chats-theme';

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--foreground', theme.colors.foreground);
  root.style.setProperty('--card', theme.colors.card);
  root.style.setProperty('--popover', theme.colors.card);
  root.style.setProperty('--secondary', theme.colors.accent);
  root.style.setProperty('--muted', theme.colors.accent);
  root.style.setProperty('--ring', theme.colors.primary);
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);
};

export function ThemeSelector() {
  const { isPremium } = usePremium();
  const [open, setOpen] = useState(false);
  const [premiumPopupOpen, setPremiumPopupOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('default');

  // Load saved theme on mount
  useEffect(() => {
    const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedThemeId) {
      const theme = themes.find(t => t.id === savedThemeId);
      if (theme) {
        // Only apply if user has access
        if (!theme.isPremium || isPremium) {
          setSelectedTheme(theme.id);
          applyTheme(theme);
        }
      }
    }
  }, [isPremium]);

  const handleThemeSelect = (theme: Theme) => {
    if (theme.isPremium && !isPremium) {
      setPremiumPopupOpen(true);
      return;
    }
    
    setSelectedTheme(theme.id);
    applyTheme(theme);
    setOpen(false);
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
                    style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: `hsl(${theme.colors.background})` }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: `hsl(${theme.colors.accent})` }}
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
