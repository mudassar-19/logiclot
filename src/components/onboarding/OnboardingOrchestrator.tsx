import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight, ChevronLeft, X, Upload,
  LayoutDashboard, SlidersHorizontal, ClipboardList, Map,
  Rocket,
} from 'lucide-react';
import logo from '@/assets/logo.png';

/* ── Phase definitions ── */
export type OnboardingPhase = 'welcome' | 'dashboard' | 'preferences' | 'buylist' | 'lane-strategy' | 'final';

interface PhaseStep {
  target: string;
  title: string;
  content: string;
  note?: string;
  requireClick?: boolean;
  requireClickLabel?: string;
}

const PHASE_STEPS: Record<Exclude<OnboardingPhase, 'welcome' | 'final'>, PhaseStep[]> = {
  dashboard: [
    {
      target: 'dash-summary-cards',
      title: 'Your Auction Performance',
      content: 'These cards show key metrics: vehicles analyzed, estimated profit, and time saved.',
    },
    {
      target: 'dash-upload-btn',
      title: 'Upload Your Run List',
      content: 'Upload any run list (CSV, Excel, or PDF) from any auction house here to analyze it automatically.',
    },
  ],
  preferences: [
    {
      target: 'pref-overview',
      title: 'Your Buying Strategy',
      content: 'Set your price, mileage, condition, brand, and profit thresholds. LogicLot uses these to filter and sort your lists.',
    },
    {
      target: 'pref-save',
      title: 'Save & Apply Strategy',
      content: 'Save your strategy to instantly regenerate and customize all buy lists according to your rules.',
    },
  ],
  buylist: [
    {
      target: 'buylist-header',
      title: 'AI Buy List Overview',
      content: 'See recommended vehicles that match your strategy, along with total estimated profit.',
    },
    {
      target: 'buylist-vehicle-info',
      title: 'Vehicle Details & Highlights',
      content: 'Click any vehicle row to view its full AI intelligence breakdown, risk alerts, and comparable retail market data.',
    },
    {
      target: 'buylist-maxbid',
      title: 'Target Bid Ceiling',
      content: 'Maximum Bid is the bid ceiling calculated by the AI to protect your profit margin. Never bid above this amount.',
    },
  ],
  'lane-strategy': [
    {
      target: 'lane-view-toggle',
      title: 'Lane & Run Sequencing',
      content: 'Organize your buy list by Lane or Run Order. Use this in the lanes to bid on high-profit vehicles in sequence.',
    },
  ],
};

const STEP_PHASES: OnboardingPhase[] = ['dashboard', 'preferences', 'buylist', 'lane-strategy'];
const PHASE_ORDER: OnboardingPhase[] = ['welcome', 'dashboard', 'preferences', 'buylist', 'lane-strategy', 'final'];
const PHASE_ROUTES: Record<string, string> = {
  dashboard: '/app/dashboard',
  preferences: '/app/preferences',
  buylist: '/app/buy-list',
  'lane-strategy': '/app/lane-strategy',
};
const PHASE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  preferences: 'Preferences',
  buylist: 'Buy List',
  'lane-strategy': 'Lane Strategy',
};
const PHASE_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-3.5 w-3.5" />,
  preferences: <SlidersHorizontal className="h-3.5 w-3.5" />,
  buylist: <ClipboardList className="h-3.5 w-3.5" />,
  'lane-strategy': <Map className="h-3.5 w-3.5" />,
};

interface Props {
  active: boolean;
  phase: OnboardingPhase;
  onPhaseChange: (phase: OnboardingPhase) => void;
  onComplete: () => void;
  onSkip: () => void;
  onReconClick?: () => void;
  onRetailClick?: () => void;
}

const OnboardingOrchestrator = ({
  active, phase, onPhaseChange, onComplete, onSkip,
  onReconClick, onRetailClick,
}: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isWelcome = phase === 'welcome';
  const isFinal = phase === 'final';
  const isModal = isWelcome || isFinal;
  const steps = isModal ? [] : (PHASE_STEPS[phase as Exclude<OnboardingPhase, 'welcome' | 'final'>] || []);
  const currentStep = step < steps.length ? steps[step] : null;

  // Total steps for progress
  const totalSteps = Object.values(PHASE_STEPS).reduce((s, arr) => s + arr.length, 0);
  const completedBefore = STEP_PHASES.slice(0, STEP_PHASES.indexOf(phase))
    .filter(p => p !== 'welcome' && p !== 'final')
    .reduce((s, p) => s + (PHASE_STEPS[p as keyof typeof PHASE_STEPS]?.length || 0), 0);
  const globalProgress = isWelcome ? 0 : isFinal ? 100 : Math.round(((completedBefore + step) / totalSteps) * 100);

  // Navigate to correct route when phase changes
  useEffect(() => {
    if (!active || isModal) return;
    const targetRoute = PHASE_ROUTES[phase];
    if (targetRoute && !location.pathname.startsWith(targetRoute.split('?')[0])) {
      if (phase === 'buylist') {
        navigate('/app/buy-list?demo=true');
      } else {
        navigate(targetRoute);
      }
    }
    // Scroll to top on phase change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase, active, isModal, navigate, location.pathname]);

  // Reset step when phase changes
  useEffect(() => {
    setStep(0);
    setWaitingForClick(false);
  }, [phase]);

  // Track target element position
  const updateTargetRect = useCallback(() => {
    if (!currentStep || isModal) { setTargetRect(null); return; }
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Scroll into view if needed
      if (rect.top < 80 || rect.bottom > window.innerHeight - 40) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const freshEl = document.querySelector(`[data-tour="${currentStep.target}"]`);
          if (freshEl) setTargetRect(freshEl.getBoundingClientRect());
        }, 450);
      }
    } else {
      setTargetRect(null);
      // If target doesn't exist, skip to next step after a short delay
    }
  }, [currentStep, isModal]);

  useEffect(() => {
    if (!active || isModal) return;
    const initTimer = setTimeout(updateTargetRect, 400);
    const interval = setInterval(updateTargetRect, 800);
    observerRef.current = new ResizeObserver(updateTargetRect);
    observerRef.current.observe(document.body);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      observerRef.current?.disconnect();
    };
  }, [active, isModal, updateTargetRect]);

  // Set waiting for click state
  useEffect(() => {
    setWaitingForClick(!!currentStep?.requireClick);
  }, [currentStep]);

  // Listen for clicks on required elements
  useEffect(() => {
    if (!active || !waitingForClick || !currentStep) return;
    const handleClick = (e: MouseEvent) => {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el && (el.contains(e.target as Node) || el === e.target)) {
        if (currentStep.target === 'buylist-recon') onReconClick?.();
        if (currentStep.target === 'buylist-retail') onRetailClick?.();
        setWaitingForClick(false);
        setTimeout(() => setStep(s => s + 1), 600);
      }
    };
    window.addEventListener('click', handleClick, true);
    return () => window.removeEventListener('click', handleClick, true);
  }, [active, waitingForClick, currentStep, onReconClick, onRetailClick]);

  if (!active) return null;

  const goNext = () => {
    if (waitingForClick) setWaitingForClick(false);
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      const idx = PHASE_ORDER.indexOf(phase);
      if (idx < PHASE_ORDER.length - 1) {
        onPhaseChange(PHASE_ORDER[idx + 1]);
      }
    }
  };

  const goPrev = () => {
    if (waitingForClick) setWaitingForClick(false);
    if (step > 0) {
      setStep(s => s - 1);
    } else {
      const idx = PHASE_ORDER.indexOf(phase);
      if (idx > 0) {
        const prevPhase = PHASE_ORDER[idx - 1];
        if (prevPhase === 'welcome') {
          onPhaseChange('welcome');
        } else {
          onPhaseChange(prevPhase);
          setTimeout(() => {
            const prevSteps = PHASE_STEPS[prevPhase as keyof typeof PHASE_STEPS];
            if (prevSteps) setStep(prevSteps.length - 1);
          }, 100);
        }
      }
    }
  };

  // ── Smart tooltip positioning ──
  const computeTooltipStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'fixed', zIndex: 10002 };
    if (!targetRect || isModal) {
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 420, maxWidth: 'calc(100vw - 32px)' };
    }

    const tooltipW = Math.min(400, window.innerWidth - 32);
    const tooltipH = cardRef.current?.offsetHeight || 280;
    const pad = 16;
    const highlightPad = 12;

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const spaceAbove = targetRect.top - highlightPad;
    const spaceBelow = window.innerHeight - targetRect.bottom - highlightPad;
    const spaceRight = window.innerWidth - targetRect.right - highlightPad;
    const spaceLeft = targetRect.left - highlightPad;

    let top: number;
    let left: number;

    // Prefer below, then above, then right, then left
    if (spaceBelow >= tooltipH + pad) {
      top = targetRect.bottom + highlightPad + pad;
      left = targetCenterX - tooltipW / 2;
    } else if (spaceAbove >= tooltipH + pad) {
      top = targetRect.top - highlightPad - pad - tooltipH;
      left = targetCenterX - tooltipW / 2;
    } else if (spaceRight >= tooltipW + pad) {
      top = targetCenterY - tooltipH / 2;
      left = targetRect.right + highlightPad + pad;
    } else if (spaceLeft >= tooltipW + pad) {
      top = targetCenterY - tooltipH / 2;
      left = targetRect.left - highlightPad - pad - tooltipW;
    } else {
      // Fallback: bottom of viewport
      top = window.innerHeight - tooltipH - pad;
      left = window.innerWidth / 2 - tooltipW / 2;
    }

    // Clamp to viewport
    left = Math.max(pad, Math.min(window.innerWidth - tooltipW - pad, left));
    top = Math.max(pad, Math.min(window.innerHeight - tooltipH - pad, top));

    return { ...base, left, top, width: tooltipW };
  };

  const tooltipStyle = computeTooltipStyle();

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 z-[10000]" onClick={e => e.stopPropagation()}>
          {/* Overlay with cutout */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            <defs>
              <mask id="onboarding-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && !isModal && (
                  <rect
                    x={targetRect.left - 8}
                    y={targetRect.top - 8}
                    width={targetRect.width + 16}
                    height={targetRect.height + 16}
                    rx="10"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0" y="0" width="100%" height="100%"
              fill="rgba(0,0,0,0.55)"
              mask="url(#onboarding-mask)"
              style={{ pointerEvents: 'auto' }}
            />
          </svg>

          {/* Highlight ring */}
          {targetRect && !isModal && (
            <motion.div
              className="absolute rounded-xl border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]"
              style={{
                left: targetRect.left - 8,
                top: targetRect.top - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
                pointerEvents: 'none',
                zIndex: 10001,
              }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
            />
          )}

          {/* Click-through zone for require-click steps */}
          {targetRect && waitingForClick && (
            <div
              className="absolute cursor-pointer"
              style={{
                left: targetRect.left - 8,
                top: targetRect.top - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
                zIndex: 10003,
                pointerEvents: 'auto',
                background: 'transparent',
              }}
            />
          )}

          {/* ── WELCOME SCREEN ── */}
          {isWelcome && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-[10002]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="bg-card rounded-2xl border shadow-2xl p-8 max-w-lg mx-4 text-center"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <div className="flex justify-center mb-5">
                  <img src={logo} alt="LogicLot" className="h-14 w-14 rounded-xl" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Welcome to LogicLot
                </h2>
                <p className="text-base text-muted-foreground mb-3">
                  Ready to save time and take control of your auction intelligence with AI?
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-md mx-auto">
                  LogicLot helps you upload auction run lists, set your buying strategy, identify the best opportunities, and plan your lane strategy — faster than ever.
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="gap-2 w-full text-base"
                    onClick={() => onPhaseChange('dashboard')}
                  >
                    <Rocket className="h-5 w-5" />
                    Start Tour
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onSkip}>
                    Skip for Now
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── FINAL SCREEN ── */}
          {isFinal && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-[10002]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="bg-card rounded-2xl border shadow-2xl p-8 max-w-lg mx-4 text-center"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <div className="flex justify-center mb-5">
                  <img src={logo} alt="LogicLot" className="h-14 w-14 rounded-xl" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  You're Ready to Use LogicLot
                </h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-sm mx-auto">
                  You now know how to upload run lists, set your buying strategy, analyze your buy list, and plan lane execution with confidence.
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="gap-2 w-full text-base"
                    onClick={() => { onComplete(); navigate('/app/dashboard'); }}
                  >
                    <Upload className="h-5 w-5" />
                    Upload Your Run List
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onComplete}>
                    Close Tour
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  You can replay this tour anytime from Settings.
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* ── TOOLTIP ── */}
          {!isModal && currentStep && (
            <motion.div
              ref={cardRef}
              key={`${phase}-${step}`}
              style={tooltipStyle}
              className="bg-card rounded-xl border shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Phase progress bar */}
              <div className="h-1.5 bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={false}
                  animate={{ width: `${globalProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Phase indicators — matching sidebar icons */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-1 flex-wrap">
                {STEP_PHASES.map(p => {
                  const isActive = p === phase;
                  const isDone = STEP_PHASES.indexOf(p) < STEP_PHASES.indexOf(phase);
                  return (
                    <Badge
                      key={p}
                      variant={isActive ? 'default' : isDone ? 'secondary' : 'outline'}
                      className={`text-[10px] gap-1 px-2 py-0.5 ${isActive ? '' : isDone ? 'opacity-70' : 'opacity-40'}`}
                    >
                      {PHASE_ICONS[p]}
                      {PHASE_LABELS[p]}
                    </Badge>
                  );
                })}
              </div>

              <div className="p-5 pt-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-foreground">{currentStep.title}</h3>
                  <button
                    onClick={onSkip}
                    className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                    title="Skip tour"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {currentStep.content}
                </p>
                {currentStep.note && (
                  <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300">{currentStep.note}</p>
                  </div>
                )}
                {waitingForClick && currentStep.requireClickLabel && (
                  <div className="mt-3 rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                      👆 {currentStep.requireClickLabel}
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation — ALWAYS shows Next/Continue */}
              <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Step {completedBefore + step + 1} of {totalSteps}
                  </span>
                  <button
                    onClick={onSkip}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Skip tour
                  </button>
                </div>
                <div className="flex gap-2">
                  {(step > 0 || STEP_PHASES.indexOf(phase) > 0) && (
                    <Button variant="ghost" size="sm" onClick={goPrev} className="gap-1 h-8 text-xs">
                      <ChevronLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={goNext}
                    variant={waitingForClick ? 'outline' : 'default'}
                    className="gap-1 h-8 text-xs"
                  >
                    {waitingForClick ? 'Continue' : step === steps.length - 1 && phase === 'lane-strategy' ? 'Finish' : 'Next'}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingOrchestrator;
