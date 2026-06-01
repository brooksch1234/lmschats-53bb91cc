import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type FontSize = 'normal' | 'large' | 'xlarge';

interface AccessibilityContextType {
  highContrast: boolean;
  reducedMotion: boolean;
  dyslexic: boolean;
  fontSize: FontSize;
  setHighContrast: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setDyslexic: (v: boolean) => void;
  setFontSize: (v: FontSize) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const KEY = 'lms-a11y';

interface Stored {
  highContrast: boolean;
  reducedMotion: boolean;
  dyslexic: boolean;
  fontSize: FontSize;
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { highContrast: false, reducedMotion: false, dyslexic: false, fontSize: 'normal', ...JSON.parse(raw) };
  } catch {}
  return { highContrast: false, reducedMotion: false, dyslexic: false, fontSize: 'normal' };
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const initial = load();
  const [highContrast, setHighContrast] = useState(initial.highContrast);
  const [reducedMotion, setReducedMotion] = useState(initial.reducedMotion);
  const [dyslexic, setDyslexic] = useState(initial.dyslexic);
  const [fontSize, setFontSize] = useState<FontSize>(initial.fontSize);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-contrast', highContrast);
    root.classList.toggle('a11y-reduced-motion', reducedMotion);
    root.classList.toggle('a11y-dyslexic', dyslexic);
    root.dataset.fontSize = fontSize;
    try {
      localStorage.setItem(KEY, JSON.stringify({ highContrast, reducedMotion, dyslexic, fontSize }));
    } catch {}
  }, [highContrast, reducedMotion, dyslexic, fontSize]);

  return (
    <AccessibilityContext.Provider value={{ highContrast, reducedMotion, dyslexic, fontSize, setHighContrast, setReducedMotion, setDyslexic, setFontSize }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
