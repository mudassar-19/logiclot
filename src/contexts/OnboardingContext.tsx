import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import OnboardingOrchestrator, { type OnboardingPhase } from '@/components/onboarding/OnboardingOrchestrator';

interface OnboardingContextValue {
  isOnboarding: boolean;
  isDemoMode: boolean;
  phase: OnboardingPhase;
  startOnboarding: () => void;
  stopOnboarding: () => void;
  setPhase: (p: OnboardingPhase) => void;
  reconClickRef: React.MutableRefObject<(() => void) | undefined>;
  retailClickRef: React.MutableRefObject<(() => void) | undefined>;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  isOnboarding: false,
  isDemoMode: false,
  phase: 'welcome',
  startOnboarding: () => {},
  stopOnboarding: () => {},
  setPhase: () => {},
  reconClickRef: { current: undefined },
  retailClickRef: { current: undefined },
});

export const useOnboarding = () => useContext(OnboardingContext);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const log = logger('Onboarding');
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase>('welcome');
  const [checked, setChecked] = useState(false);
  const reconClickRef = useRef<(() => void) | undefined>(undefined);
  const retailClickRef = useRef<(() => void) | undefined>(undefined);

  // Auto-detect first-time user
  useEffect(() => {
    if (!user || !profile || checked) return;
    setChecked(true);

    const tourCompleted = (profile as any).onboarding_tour_completed;
    if (!tourCompleted && location.pathname.startsWith('/app')) {
      setIsOnboarding(true);
      setIsDemoMode(true);
      setPhase('welcome');
      if (location.pathname !== '/app/dashboard') {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }, [user, profile, checked, location.pathname, navigate]);

  const startOnboarding = useCallback(() => {
    setIsOnboarding(true);
    setIsDemoMode(true);
    setPhase('welcome');
    navigate('/app/dashboard');
  }, [navigate]);

  const stopOnboarding = useCallback(() => {
    setIsOnboarding(false);
    setIsDemoMode(false);
    if (user) {
      log.info('Onboarding tour completed, saving flag');
      supabase
        .from('profiles')
        .update({ onboarding_tour_completed: true } as any)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) log.warn('Failed to save onboarding flag', error.message);
        });
    }
  }, [user]);

  const handleComplete = useCallback(() => {
    stopOnboarding();
  }, [stopOnboarding]);

  const handleSkip = useCallback(() => {
    stopOnboarding();
  }, [stopOnboarding]);

  const handlePhaseChange = useCallback((newPhase: OnboardingPhase) => {
    setPhase(newPhase);
  }, []);

  return (
    <OnboardingContext.Provider value={{
      isOnboarding,
      isDemoMode: isDemoMode && isOnboarding,
      phase,
      startOnboarding,
      stopOnboarding,
      setPhase,
      reconClickRef,
      retailClickRef,
    }}>
      {children}
      <OnboardingOrchestrator
        active={isOnboarding}
        phase={phase}
        onPhaseChange={handlePhaseChange}
        onComplete={handleComplete}
        onSkip={handleSkip}
        onReconClick={() => reconClickRef.current?.()}
        onRetailClick={() => retailClickRef.current?.()}
      />
    </OnboardingContext.Provider>
  );
};
