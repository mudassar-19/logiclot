import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  content: string;
  note?: string;
  requireClick?: boolean;
  requireClickLabel?: string;
}

const STEPS: TourStep[] = [
  {
    target: 'buylist-table',
    title: 'Your AI-Powered Buy List',
    content: 'Every vehicle here has been analyzed for profit, risk, and bidding strategy. Click any row to see the full AI breakdown.',
  },
  {
    target: 'buylist-vehicle-info',
    title: 'Vehicle Identification',
    content: 'Full identification — year, make, model, trim, and VIN — so you can match it instantly at auction.',
  },
  {
    target: 'buylist-recon',
    title: 'Estimated Recon Cost',
    content: 'Estimated cost to get this vehicle front-line ready. Click this to adjust based on your dealership\'s real recon costs.',
    note: 'Always verify — this is an estimate using external data.',
    requireClick: true,
    requireClickLabel: 'Click Est. Recon to continue',
  },
  {
    target: 'buylist-profit',
    title: 'Estimated Profit',
    content: 'Your potential front-end profit after purchase, recon, transport, and auction fees. This is what puts money in your pocket.',
  },
  {
    target: 'buylist-maxbid',
    title: 'Maximum Bid — Your Ceiling',
    content: 'This is the most you should bid to stay profitable. Do NOT go above this number if you want to protect your margin.',
  },
  {
    target: 'buylist-airec',
    title: 'AI Recommendation',
    content: 'AI recommendation based on profit, risk, and market demand.\n\n• Strong Buy = strong deal\n• Buy = solid opportunity\n• Possible Buy = review carefully',
  },
  {
    target: 'buylist-retail',
    title: 'Retail Value',
    content: 'Estimated retail price based on market data. Click to see how this value is calculated — including estimated market supply and pricing confidence.',
    requireClick: true,
    requireClickLabel: 'Click Retail Value to continue',
  },
  {
    target: 'buylist-prefs-btn',
    title: 'Set Your Buying Strategy',
    content: 'Configure your preferences: brands you buy, price range, mileage limits, and profit targets. The AI uses these to build your buy list.',
  },
];

const FINAL_STEP_INDEX = STEPS.length;

interface Props {
  active: boolean;
  onComplete: () => void;
  onReconClick?: () => void;
  onRetailClick?: () => void;
}

const BuyListOnboarding = ({ active, onComplete, onReconClick, onRetailClick }: Props) => {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const navigate = useNavigate();
  const observerRef = useRef<ResizeObserver | null>(null);

  const updateTargetRect = useCallback(() => {
    if (step >= STEPS.length) { setTargetRect(null); return; }
    const currentStep = STEPS[step];
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Scroll into view if needed
      const viewH = window.innerHeight;
      if (rect.top < 80 || rect.bottom > viewH - 40) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Recompute after scroll
        setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 400);
      }
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!active) return;
    updateTargetRect();
    const timer = setInterval(updateTargetRect, 500);

    // Watch for resize
    observerRef.current = new ResizeObserver(updateTargetRect);
    observerRef.current.observe(document.body);

    return () => {
      clearInterval(timer);
      observerRef.current?.disconnect();
    };
  }, [active, updateTargetRect]);

  useEffect(() => {
    if (!active || step >= STEPS.length) return;
    const currentStep = STEPS[step];
    if (currentStep.requireClick) {
      setWaitingForClick(true);
    } else {
      setWaitingForClick(false);
    }
  }, [step, active]);

  // Listen for user clicks on required elements
  useEffect(() => {
    if (!active || !waitingForClick || step >= STEPS.length) return;
    const currentStep = STEPS[step];

    const handleGlobalClick = (e: MouseEvent) => {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el && (el.contains(e.target as Node) || el === e.target)) {
        // Trigger the actual click handler
        if (currentStep.target === 'buylist-recon' && onReconClick) {
          onReconClick();
        }
        if (currentStep.target === 'buylist-retail' && onRetailClick) {
          onRetailClick();
        }
        setWaitingForClick(false);
        // Auto-advance after short delay
        setTimeout(() => setStep(s => s + 1), 600);
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
  }, [active, waitingForClick, step, onReconClick, onRetailClick]);

  if (!active) return null;

  const isFinal = step >= STEPS.length;
  const currentStep = isFinal ? null : STEPS[step];
  const progress = Math.round(((step) / STEPS.length) * 100);

  const goNext = () => {
    if (waitingForClick) return;
    if (step < STEPS.length) {
      setStep(s => s + 1);
    }
  };

  const goPrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  // Tooltip position
  let tooltipStyle: React.CSSProperties = { position: 'fixed', zIndex: 10002 };
  if (targetRect) {
    const tooltipW = 380;
    const pad = 16;
    let left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
    let top = targetRect.bottom + pad;

    // If tooltip goes below viewport, position above
    if (top + 220 > window.innerHeight) {
      top = targetRect.top - pad - 220;
    }
    // Clamp horizontal
    left = Math.max(pad, Math.min(window.innerWidth - tooltipW - pad, left));
    top = Math.max(pad, top);

    tooltipStyle = { ...tooltipStyle, left, top, width: tooltipW };
  } else if (!isFinal) {
    tooltipStyle = { ...tooltipStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 380 };
  }

  return (
    <AnimatePresence>
      {active && (
        <>
          {/* Overlay with cutout */}
          <div className="fixed inset-0 z-[10000] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              <defs>
                <mask id="tour-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  {targetRect && !isFinal && (
                    <rect
                      x={targetRect.left - 6}
                      y={targetRect.top - 6}
                      width={targetRect.width + 12}
                      height={targetRect.height + 12}
                      rx="8"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                x="0" y="0" width="100%" height="100%"
                fill="rgba(0,0,0,0.6)"
                mask="url(#tour-mask)"
                style={{ pointerEvents: 'auto' }}
              />
            </svg>

            {/* Highlight ring */}
            {targetRect && !isFinal && (
              <motion.div
                className="absolute rounded-lg border-2 border-primary shadow-[0_0_0_4px_hsl(224_100%_52%/0.15)]"
                style={{
                  left: targetRect.left - 6,
                  top: targetRect.top - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                  pointerEvents: 'none',
                  zIndex: 10001,
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}

            {/* Allow clicking through to highlighted element */}
            {targetRect && waitingForClick && (
              <div
                className="absolute cursor-pointer"
                style={{
                  left: targetRect.left - 6,
                  top: targetRect.top - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                  zIndex: 10003,
                  pointerEvents: 'auto',
                  background: 'transparent',
                }}
              />
            )}

            {/* Final step overlay */}
            {isFinal && (
              <motion.div
                className="fixed inset-0 flex items-center justify-center z-[10002]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="bg-card rounded-2xl border shadow-2xl p-8 max-w-md mx-4 text-center"
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 20 }}
                >
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-2">
                    You're Ready to Find Profitable Vehicles
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    You now know exactly how to use LogicLot to identify profitable vehicles, set your max bid, and protect your margin. Upload your real run list to start making money.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      className="gap-2 w-full"
                      onClick={() => {
                        onComplete();
                        navigate('/app/dashboard');
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      Upload Your Run List
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onComplete}>
                      Continue Exploring Demo
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Tooltip */}
            {!isFinal && (
              <motion.div
                key={step}
                style={tooltipStyle}
                className="bg-card rounded-xl border shadow-2xl overflow-hidden"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {/* Progress bar */}
                <div className="h-1 bg-muted">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-foreground">{currentStep?.title}</h3>
                    <button
                      onClick={onComplete}
                      className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {currentStep?.content}
                  </p>
                  {currentStep?.note && (
                    <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                      <p className="text-xs text-amber-700 dark:text-amber-300">{currentStep.note}</p>
                    </div>
                  )}
                  {waitingForClick && currentStep?.requireClickLabel && (
                    <div className="mt-3 rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                      <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                        👆 {currentStep.requireClickLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/30">
                  <span className="text-xs text-muted-foreground">
                    {step + 1} of {STEPS.length}
                  </span>
                  <div className="flex gap-2">
                    {step > 0 && (
                      <Button variant="ghost" size="sm" onClick={goPrev} className="gap-1 h-8 text-xs">
                        <ChevronLeft className="h-3.5 w-3.5" /> Back
                      </Button>
                    )}
                    {!waitingForClick && (
                      <Button size="sm" onClick={goNext} className="gap-1 h-8 text-xs">
                        {step === STEPS.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BuyListOnboarding;
