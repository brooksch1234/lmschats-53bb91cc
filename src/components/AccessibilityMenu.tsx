import { Accessibility } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAccessibility } from '@/hooks/useAccessibility';

export function AccessibilityMenu() {
  const {
    highContrast, setHighContrast,
    reducedMotion, setReducedMotion,
    dyslexic, setDyslexic,
    fontSize, setFontSize,
  } = useAccessibility();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Accessibility options" title="Accessibility">
          <Accessibility className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-1">Accessibility</h4>
            <p className="text-xs text-muted-foreground">Tweak the app to suit your needs.</p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="a11y-contrast" className="text-sm">High contrast</Label>
            <Switch id="a11y-contrast" checked={highContrast} onCheckedChange={setHighContrast} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="a11y-motion" className="text-sm">Reduce motion</Label>
            <Switch id="a11y-motion" checked={reducedMotion} onCheckedChange={setReducedMotion} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="a11y-dyslexic" className="text-sm">Dyslexia-friendly font</Label>
            <Switch id="a11y-dyslexic" checked={dyslexic} onCheckedChange={setDyslexic} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Text size</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['normal', 'large', 'xlarge'] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={fontSize === s ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setFontSize(s)}
                >
                  {s === 'normal' ? 'A' : s === 'large' ? 'A+' : 'A++'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
