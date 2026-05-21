import { useState, useEffect } from 'react';
import { Palette, Crown, Check, Sparkles } from 'lucide-react';
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
  animated?: string; // key for body[data-theme-anim]
  colors: {
    primary: string;
    background: string;
    accent: string;
    foreground: string;
    card: string;
    primaryGlow?: string;
  };
  swatch: string[]; // preview gradient hex
}

const themes: Theme[] = [
  // FREE
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
      primaryGlow: '205 85% 65%',
    },
    swatch: ['#1f3a5f', '#3b82f6', '#60a5fa'],
  },
  {
    id: 'slate',
    name: 'Midnight Slate',
    isPremium: false,
    colors: {
      primary: '220 15% 75%',
      background: '220 18% 12%',
      accent: '220 15% 22%',
      foreground: '220 15% 95%',
      card: '220 18% 16%',
      primaryGlow: '220 15% 85%',
    },
    swatch: ['#1f2937', '#374151', '#9ca3af'],
  },
  // PREMIUM ANIMATED
  {
    id: 'aurora',
    name: 'Aurora',
    isPremium: true,
    animated: 'aurora',
    colors: {
      primary: '260 85% 65%',
      background: '250 40% 12%',
      accent: '280 50% 25%',
      foreground: '260 20% 96%',
      card: '250 35% 16%',
      primaryGlow: '290 85% 70%',
    },
    swatch: ['#0f0c29', '#302b63', '#a78bfa'],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    isPremium: true,
    animated: 'cyberpunk',
    colors: {
      primary: '325 95% 60%',
      background: '280 50% 8%',
      accent: '180 90% 35%',
      foreground: '180 100% 95%',
      card: '280 45% 12%',
      primaryGlow: '180 100% 60%',
    },
    swatch: ['#ff0080', '#00ffe0', '#1a0033'],
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    isPremium: true,
    animated: 'galaxy',
    colors: {
      primary: '220 90% 60%',
      background: '230 70% 8%',
      accent: '270 60% 25%',
      foreground: '220 30% 96%',
      card: '230 60% 12%',
      primaryGlow: '270 80% 70%',
    },
    swatch: ['#000428', '#004e92', '#2a0845'],
  },
  {
    id: 'sunset',
    name: 'Sunset Blaze',
    isPremium: true,
    animated: 'sunset',
    colors: {
      primary: '15 90% 60%',
      background: '340 35% 12%',
      accent: '30 80% 35%',
      foreground: '30 30% 96%',
      card: '340 30% 16%',
      primaryGlow: '340 85% 60%',
    },
    swatch: ['#ff512f', '#f09819', '#dd2476'],
  },
  // PREMIUM STATIC
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
      primaryGlow: '160 70% 55%',
    },
    swatch: ['#064e3b', '#10b981', '#6ee7b7'],
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    isPremium: true,
    colors: {
      primary: '340 75% 60%',
      background: '340 20% 13%',
      accent: '340 50% 25%',
      foreground: '340 20% 96%',
      card: '340 22% 18%',
      primaryGlow: '15 80% 65%',
    },
    swatch: ['#831843', '#ec4899', '#fda4af'],
  },
];

const THEME_STORAGE_KEY = 'lms-chats-theme';

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--primary', c.primary);
  root.style.setProperty('--background', c.background);
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--foreground', c.foreground);
  root.style.setProperty('--card', c.card);
  root.style.setProperty('--popover', c.card);
  root.style.setProperty('--secondary', c.accent);
  root.style.setProperty('--muted', c.accent);
  root.style.setProperty('--ring', c.primary);
  if (c.primaryGlow) root.style.setProperty('--primary-glow', c.primaryGlow);

  if (theme.animated) {
    document.body.setAttribute('data-theme-anim', theme.animated);
  } else {
    document.body.removeAttribute('data-theme-anim');
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);
};

export function ThemeSelector() {
  const { isPremium } = usePremium();
  const [open, setOpen] = useState(false);
  const [premiumPopupOpen, setPremiumPopupOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('default');

  useEffect(() => {
    const savedId = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedId) {
      const t = themes.find(x => x.id === savedId);
      if (t && (!t.isPremium || isPremium)) {
        setSelectedTheme(t.id);
        applyTheme(t);
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

  const renderCard = (theme: Theme) => {
    const isSelected = selectedTheme === theme.id;
    const locked = theme.isPremium && !isPremium;
    const gradient = `linear-gradient(135deg, ${theme.swatch.join(', ')})`;

    return (
      <button
        key={theme.id}
        onClick={() => handleThemeSelect(theme)}
        className={`relative p-3 rounded-xl border-2 transition-all overflow-hidden text-left ${
          isSelected ? 'border-primary' : 'border-border/50 hover:border-primary/50'
        }`}
      >
        <div
          className={`h-16 w-full rounded-lg mb-3 ${theme.animated ? 'animate-[themeGradient_8s_ease_infinite]' : ''}`}
          style={{
            background: gradient,
            backgroundSize: theme.animated ? '300% 300%' : 'auto',
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate">{theme.name}</p>
          <div className="flex items-center gap-1 shrink-0">
            {theme.animated && <Sparkles className="w-3.5 h-3.5 text-yellow-400" />}
            {locked && <Crown className="w-4 h-4 text-yellow-500" />}
            {isSelected && <Check className="w-4 h-4 text-primary" />}
          </div>
        </div>
        {theme.isPremium && (
          <p className="text-[10px] text-yellow-500 mt-1">
            {theme.animated ? 'Premium · Animated' : 'Premium'}
          </p>
        )}
      </button>
    );
  };

  const freeThemes = themes.filter(t => !t.isPremium);
  const animatedThemes = themes.filter(t => t.isPremium && t.animated);
  const staticPremium = themes.filter(t => t.isPremium && !t.animated);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Palette className="w-5 h-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="glass-card border-border/50 sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Website Themes
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Free</p>
              <div className="grid grid-cols-2 gap-3">
                {freeThemes.map(renderCard)}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-yellow-400" /> Animated · Premium
              </p>
              <div className="grid grid-cols-2 gap-3">
                {animatedThemes.map(renderCard)}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Premium</p>
              <div className="grid grid-cols-2 gap-3">
                {staticPremium.map(renderCard)}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PremiumPopup
        open={premiumPopupOpen}
        onOpenChange={setPremiumPopupOpen}
        featureName="Premium Themes"
      />
    </>
  );
}
