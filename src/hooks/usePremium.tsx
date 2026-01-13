import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PremiumContextType {
  isPremium: boolean;
  loading: boolean;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) {
        setIsPremium(false);
        setLoading(false);
        return;
      }

      // Check if user has a premium tag
      const { data: userTags } = await supabase
        .from('user_tags')
        .select(`
          tag_id,
          tags!inner(name)
        `)
        .eq('user_id', user.id);

      // Check for premium-granting tags (OWNER, ADMIN, or PREMIUM)
      const premiumTags = ['OWNER', 'ADMIN', 'PREMIUM'];
      const hasPremium = userTags?.some((ut: any) => 
        premiumTags.includes(ut.tags?.name)
      ) || false;

      setIsPremium(hasPremium);
      setLoading(false);
    };

    checkPremiumStatus();
  }, [user]);

  return (
    <PremiumContext.Provider value={{ isPremium, loading }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
}
