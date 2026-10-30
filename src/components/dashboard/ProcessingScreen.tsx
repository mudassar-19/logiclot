import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  firstFatalScoringError,
  runRunListScoringPipeline,
  scoringWarnings,
} from '@/lib/runListScoringPipeline';
import {
  Check, AlertCircle, FileSearch, Database, BarChart3, ListChecks,
  TrendingUp, DollarSign, ShieldCheck, Sparkles, Zap, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import logoImg from '@/assets/logo.png';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const log = logger('ProcessingScreen');

function getPhase(step: number) {
  if (step <= 1) return 0;
  if (step === 2) return 1;
  if (step <= 4) return 2;
  return 3;
}

const PHASE_META = [
  { label: 'Reading',   icon: FileSearch },
  { label: 'Decoding',  icon: Database   },
  { label: 'Analyzing', icon: BarChart3  },
  { label: 'Building',  icon: ListChecks },
];

const FUN_FACTS: Record<number, string[]> = {
  0: [
    'Tip: CSV files process up to 3× faster than image-based PDFs.',
    'Tip: Including VINs in your run list significantly improves data accuracy.',
    'LogicLot supports Manheim, ADESA, CarMax Auctions, and Copart run list formats.',
  ],
  1: [
    'A 17-digit VIN encodes the country, manufacturer, model year, assembly plant, and production sequence.',
    'LogicLot validates each VIN against the NHTSA database — the same source used by insurers and lenders.',
    'Trim-level detection improves recon estimates by accounting for vehicle complexity.',
    'Vehicles with a condition report typically transact 15% closer to their retail value at auction.',
  ],
  2: [
    "LogicLot's profit engine weighs wholesale reference, recon cost, auction fees, retail comps, and market velocity.",
    'Est. Market Supply measures estimated days of active inventory for a vehicle type in your area — lower is better.',
    'Live market comps are pulled from comparable active listings to deliver a real-time retail estimate.',
    'Vehicles below 30 days of market supply often sell within 2 weeks of retail listing.',
  ],
  3: [
    'A "Strong Buy" has a profit score of 85+/100 — factoring in margin, demand, and vehicle condition.',
    'Your dealer preferences are applied as hard filters to exclude vehicles outside your buying criteria.',
    'The recommended max bid includes a calculated buffer for auction fees and estimated reconditioning.',
  ],
};

const ENRICH_POINTS = [
  'VIN structure validated',
  'Model year & make confirmed',
  'Trim & series detected',
  'Body & drivetrain classified',
  'Engine & transmission specs',
  'Safety recall history',
  'Market history lookup',
];

const ANALYSIS_CARDS = [
  { icon: DollarSign,  label: 'Wholesale Ref',  detail: 'MMR & auction data'  },
  { icon: TrendingUp,  label: 'Est. Retail',    detail: 'Live market comps'   },
  { icon: ShieldCheck, label: 'Recon Cost',     detail: 'CR + mileage model'  },
  { icon: Sparkles,    label: 'Profit Score',   detail: 'Opportunity index'   },
];

// ─── Phase Stepper ────────────────────────────────────────────────────────────

function PhaseStepper({ phase }: { phase: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-8 md:mb-14 max-w-full px-2">
      {PHASE_META.map((p, i) => {
        const done    = i < phase;
        const active  = i === phase;
        const Icon    = p.icon;
        return (
          <div key={i} className="flex items-center gap-1.5 sm:gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-500 ${
              active  ? 'bg-primary text-primary-foreground shadow-sm' :
              done    ? 'bg-primary/15 text-primary' :
                        'bg-muted/50 text-muted-foreground/40'
            }`}>
              {done ? (
                <Check className="h-3 w-3 stroke-[3] shrink-0" />
              ) : (
                <Icon className={`h-3 w-3 shrink-0 ${active ? '' : 'opacity-60'}`} />
              )}
              <span>{p.label}</span>
            </div>
            {i < PHASE_META.length - 1 && (
              <div className={`hidden sm:block h-px w-4 transition-colors duration-500 ${i < phase ? 'bg-primary/30' : 'bg-border/40'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tip card ────────────────────────────────────────────────────────────────

function TipCard({ text }: { text: string }) {
  return (
    <div className="w-full max-w-md rounded-xl border border-border/50 bg-muted/40 px-4 py-3 text-left mt-auto">
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground">💡 </span>{text}
      </p>
    </div>
  );
}

// ─── Phase 0: Reading File ────────────────────────────────────────────────────

function PhaseReading({
  pagesProcessed, totalPages, vehiclesFound, progressPercent, tip, forceComplete,
}: {
  pagesProcessed: number; totalPages: number; vehiclesFound: number;
  progressPercent: number; tip: string; forceComplete?: boolean;
}) {
  const rawPct = totalPages > 0 ? Math.round((pagesProcessed / totalPages) * 100) : progressPercent;
  const pct = forceComplete ? 100 : rawPct;
  return (
    <div className="flex flex-col items-center w-full max-w-md text-center flex-grow min-h-fit pb-6">
      <div className="relative mb-8">
        <div className="h-24 w-24 rounded-2xl bg-primary/8 border border-primary/20 flex items-center justify-center">
          <FileSearch className="h-12 w-12 text-primary" />
        </div>
        <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Zap className="h-3.5 w-3.5 text-primary animate-pulse" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">Reading Your Run List</h2>
      <p className="text-muted-foreground mb-8 text-base leading-relaxed">
        {forceComplete
          ? 'File read complete'
          : totalPages > 0
            ? `Scanning page ${Math.min(pagesProcessed + 1, totalPages)} of ${totalPages}`
            : 'Parsing your file and locating vehicles…'}
      </p>

      <div className="w-full mb-2">
        <Progress value={pct} className="h-2.5 rounded-full" />
      </div>
      <div className="flex justify-between w-full text-xs text-muted-foreground mb-8">
        <span>{forceComplete ? `${totalPages > 0 ? totalPages : ''} ${totalPages > 0 ? 'pages scanned' : 'Complete'}`.trim() : totalPages > 0 ? `${pagesProcessed} of ${totalPages} pages scanned` : 'Processing…'}</span>
        <span>{pct}%</span>
      </div>

      {vehiclesFound > 0 && (
        <div className="flex gap-8 mb-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground tabular-nums">{vehiclesFound.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Vehicles found</div>
          </div>
        </div>
      )}

      <TipCard text={tip} />
    </div>
  );
}

// ─── Phase 1: Decoding Vehicles ───────────────────────────────────────────────

function PhaseDecoding({
  vehiclesFound, tip, forceComplete,
}: {
  vehiclesFound: number; tip: string; forceComplete?: boolean;
}) {

  return (
    <div className="flex flex-col items-center w-full max-w-md text-center flex-grow min-h-fit pb-6">
      <div className="relative mb-8">
        <div className="h-24 w-24 rounded-2xl bg-primary/8 border border-primary/20 flex items-center justify-center">
          <Database className="h-12 w-12 text-primary" />
        </div>
        <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Zap className="h-3.5 w-3.5 text-primary animate-pulse" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">Decoding Vehicle Data</h2>
      <p className="text-muted-foreground mb-6 text-base leading-relaxed">
        Cross-referencing {vehiclesFound > 0 ? <><span className="font-semibold text-foreground">{vehiclesFound}</span> vehicles</> : 'your vehicles'} with NHTSA &amp; industry databases
      </p>

      {/* Indeterminate progress bar — no real sub-progress available for this step */}
      <div className="w-full mb-2 h-2.5 rounded-full bg-secondary overflow-hidden">
        {forceComplete ? (
          <div className="h-full w-full rounded-full bg-primary transition-all duration-500" />
        ) : (
          <div className="h-full rounded-full bg-primary animate-[indeterminate_1.6s_ease-in-out_infinite]" style={{ width: '40%' }} />
        )}
      </div>
      <div className="flex justify-between w-full text-xs text-muted-foreground mb-6">
        <span>{forceComplete ? 'Decode complete' : 'Decoding…'}</span>
        <span>{forceComplete ? '100%' : ''}</span>
      </div>

      <div className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 mb-6">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-left">NHTSA Data Points</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4">
          {ENRICH_POINTS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${forceComplete ? 'bg-primary' : 'border-2 border-primary'}`}>
                {forceComplete ? (
                  <Check className="h-2.5 w-2.5 text-primary-foreground stroke-[3]" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <span className={forceComplete ? 'text-foreground font-medium' : 'text-muted-foreground'}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <TipCard text={tip} />
    </div>
  );
}

// ─── Phase 2: Analyzing + Market Data ────────────────────────────────────────

function PhaseAnalyzing({
  vehiclesFound, progressPercent, currentStep, tip, forceComplete,
}: {
  vehiclesFound: number; progressPercent: number; currentStep: number; tip: string; forceComplete?: boolean;
}) {
  const phaseStart = 77; const phaseEnd = 90;
  const rawPct = Math.min(100, Math.round(Math.max(0, (progressPercent - phaseStart) / (phaseEnd - phaseStart)) * 100));
  const pct = forceComplete ? 100 : rawPct;
  const marketFetching = !forceComplete && currentStep === 4;

  return (
    <div className="flex flex-col items-center w-full max-w-md text-center flex-grow min-h-fit pb-6">
      <div className="relative mb-8">
        <div className="h-24 w-24 rounded-2xl bg-primary/8 border border-primary/20 flex items-center justify-center">
          <BarChart3 className="h-12 w-12 text-primary" />
        </div>
        {marketFetching && (
          <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <MapPin className="h-3.5 w-3.5 text-primary animate-pulse" />
          </div>
        )}
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">Analyzing Opportunities</h2>
      <p className="text-muted-foreground mb-6 text-base leading-relaxed">
        {marketFetching
          ? <>Fetching live market comps for {vehiclesFound > 0 ? <span className="font-semibold text-foreground">{vehiclesFound}</span> : 'your'} vehicles</>
          : <>Running profit engine across {vehiclesFound > 0 ? <span className="font-semibold text-foreground">{vehiclesFound}</span> : 'your'} vehicles</>}
      </p>

      <div className="w-full mb-2">
        <Progress value={pct} className="h-2.5 rounded-full" />
      </div>
      <div className="flex justify-between w-full text-xs text-muted-foreground mb-6">
        <span>{forceComplete ? 'Analysis complete' : marketFetching ? 'Fetching market pricing data…' : 'Scoring each vehicle…'}</span>
        <span>{pct}%</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-6">
        {ANALYSIS_CARDS.map(({ icon: Icon, label, detail }, i) => {
          const activated = pct >= (i + 1) * 22;
          return (
            <div key={i} className={`rounded-xl border p-3.5 text-left transition-all duration-500 ${
              activated ? 'border-primary/30 bg-primary/5 opacity-100' : 'border-border/40 bg-muted/20 opacity-25'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 shrink-0 ${activated ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-semibold ${activated ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{detail}</p>
              {activated && (
                <div className="mt-2 h-0.5 w-full rounded bg-primary/20">
                  <div className="h-0.5 rounded bg-primary/60" style={{ width: '100%', transition: 'width 1.5s ease-out' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TipCard text={tip} />
    </div>
  );
}

// ─── Phase 3: Building Buy List ───────────────────────────────────────────────

function PhaseBuilding({
  vehiclesFound, progressPercent, tip, forceComplete,
}: {
  vehiclesFound: number; progressPercent: number; tip: string; forceComplete?: boolean;
}) {
  const rawPct = Math.min(100, Math.round(Math.max(0, (progressPercent - 90) / 10) * 100));
  const pct = forceComplete ? 100 : rawPct;
  return (
    <div className="flex flex-col items-center w-full max-w-md text-center flex-grow min-h-fit pb-6">
      <div className="relative mb-8">
        <div className="h-24 w-24 rounded-2xl bg-primary/8 border border-primary/20 flex items-center justify-center">
          <ListChecks className="h-12 w-12 text-primary" />
        </div>
        <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-green-500 animate-pulse" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">Building Your Buy List</h2>
      <p className="text-muted-foreground mb-6 text-base leading-relaxed">
        Applying your preferences and ranking {vehiclesFound > 0 ? <><span className="font-semibold text-foreground">{vehiclesFound}</span> opportunities</> : 'opportunities'}
      </p>

      <div className="w-full mb-2">
        <Progress value={pct} className="h-2.5 rounded-full" />
      </div>
      <div className="text-xs text-muted-foreground text-right w-full mb-6">
        {pct >= 100 ? 'Finalizing…' : `${pct}%`}
      </div>

      {vehiclesFound > 0 && (
        <div className="w-full rounded-xl border border-border/60 bg-muted/20 px-5 py-4 mb-6 text-left">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Vehicles analyzed</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">{vehiclesFound.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Applying your dealer preferences and ranking by profit score</p>
        </div>
      )}

      <TipCard text={tip} />
    </div>
  );
}

interface ProcessingScreenProps {
  runListId: string;
  organizationId: string;
  onError: () => void;
}

// Run 3 pages concurrently per batch — enough parallelism without overwhelming the edge function's
// 60s wall-clock limit. Each individual Gemini call has a 55s timeout.
const OCR_BATCH_SIZE = 3;
// Total wall-clock budget for the parse phase (polling loop only — OCR loop is separate).
// Large image-based PDFs (35 pages) can take 8–12 minutes total.
// 600 polls × 1.5s = 15 minutes — generous enough for any realistic run list.
const MAX_POLL_COUNT = 600;

const ProcessingScreen = ({ runListId, organizationId, onError }: ProcessingScreenProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vehiclesFound, setVehiclesFound] = useState(0);
  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [funFactIndex, setFunFactIndex] = useState(0);
  const startTimeRef = useRef(Date.now());

  const phase = getPhase(currentStep);
  const [displayPhase, setDisplayPhase] = useState(0);
  const [forceComplete, setForceComplete] = useState(false);

  // When the logical phase advances, pin current display phase at 100%,
  // hold for 750ms so the user sees completion, then flip to the new phase.
  useEffect(() => {
    if (phase === displayPhase) return;
    setForceComplete(true);
    const tid = setTimeout(() => {
      setDisplayPhase(phase);
      setForceComplete(false);
    }, 750);
    return () => clearTimeout(tid);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rotate fun facts every 5 s, reset on phase change
  useEffect(() => {
    setFunFactIndex(0);
    const facts = FUN_FACTS[displayPhase] ?? FUN_FACTS[0];
    const id = setInterval(() => setFunFactIndex(i => (i + 1) % facts.length), 5000);
    return () => clearInterval(id);
  }, [displayPhase]);

  const fail = useCallback((msg: string, step: string) => {
    log.error(`Failed at step: "${step}"`, msg);
    toast.error(`Failed: ${step}`);
    setErrorMessage(`${step}: ${msg}`);
  }, []);

  // Parallel batched OCR
  const runClientDrivenOCR = useCallback(async (pageCount: number) => {
    log.info(`Starting parallel OCR for ${pageCount} pages (batch size: ${OCR_BATCH_SIZE})`);
    setCurrentStep(1); // keep on Phase 0 (Reading) — OCR is still part of file-reading
    setTotalPages(pageCount);

    await (supabase as any).from('auction_run_lists')
      .update({ parse_status: 'ocr_processing' }).eq('id', runListId);

    let totalVehicles = 0;
    let processed = 0;
    let failedPages = 0;

    for (let batchStart = 0; batchStart < pageCount; batchStart += OCR_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + OCR_BATCH_SIZE, pageCount);
      const pagePromises = [];

      for (let page = batchStart; page < batchEnd; page++) {
        pagePromises.push(
          supabase.functions.invoke('parse-run-list', {
            body: { run_list_id: runListId, mode: 'ocr_page', page_number: page },
          }).then(({ data, error }) => {
            if (error) {
              log.error(`OCR page ${page + 1} error`, error);
              failedPages++;
              return 0;
            }
            return data?.vehicles_found || 0;
          }).catch((err) => {
            log.error(`OCR page ${page + 1} exception`, err);
            failedPages++;
            return 0;
          })
        );
      }

      const results = await Promise.all(pagePromises);
      for (const count of results) {
        totalVehicles += count;
        processed++;
      }

      setVehiclesFound(totalVehicles);
      setPagesProcessed(processed);
      // Progress: OCR is ~60% of total work (steps 0-1 are 15%, step 3 is 25%)
      setProgressPercent(Math.round(15 + (processed / pageCount) * 60));
    }

    log.info(`Parallel OCR complete: ${totalVehicles} vehicles from ${processed} pages (${failedPages} failed)`);

    if (totalVehicles === 0) {
      log.warn('Page-by-page OCR found no vehicles; trying forced inline PDF parsing fallback');
      const { data, error } = await supabase.functions.invoke('parse-run-list', {
        body: { run_list_id: runListId, mode: 'force_inline_ocr' },
      });

      if (error) {
        log.error('Forced inline OCR fallback failed', error.message);
      } else {
        const fallbackVehicles = Number(data?.vehicles_inserted ?? data?.vehicles_extracted ?? 0);
        if (fallbackVehicles > 0) {
          setVehiclesFound(fallbackVehicles);
          return true;
        }
      }

      await (supabase as any).from('auction_run_lists')
        .update({
          parse_status: 'failed',
          parse_error: 'OCR could not extract any vehicles from this PDF. Try exporting it to Excel or CSV.',
          status: 'failed',
        }).eq('id', runListId);
      fail('No vehicles could be extracted from this image-based PDF.', 'Analyzing vehicles');
      return false;
    }

    await (supabase as any).from('auction_run_lists')
      .update({ parse_status: 'completed' }).eq('id', runListId);
    return true;
  }, [runListId, fail]);

  // Prevent page + overlay double scrollbars while processing
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    startTimeRef.current = Date.now();

    const run = async () => {
      log.info('Starting processing for run_list_id:', runListId);

      // Already finished — navigate without re-running parse/scoring pipeline
      const { data: existingRun } = await (supabase as any)
        .from('auction_run_lists')
        .select('status, parse_status')
        .eq('id', runListId)
        .single();
      if (existingRun?.status === 'ready' && existingRun?.parse_status === 'completed') {
        navigate(`/app/buy-list?run_list_id=${runListId}`);
        return;
      }

      // Step 0 — Upload
      await (supabase as any).from('auction_run_lists').update({ status: 'processing' }).eq('id', runListId);
      setCurrentStep(0);
      setProgressPercent(5);
      if (cancelled) return;

      // Trigger parsing in case the upload-side invoke failed or was skipped
      // Check current DB status first to avoid duplicate invocation if already processing
      const { data: runListInit } = await (supabase as any)
        .from('auction_run_lists')
        .select('parse_status')
        .eq('id', runListId)
        .single();

      const activeStatuses = [
        'detecting_file_type',
        'parsing_vehicles',
        'queued_for_ocr',
        'ocr_processing',
        'completed'
      ];
      
      const isAlreadyProcessing = runListInit && activeStatuses.includes(runListInit.parse_status);

      if (!isAlreadyProcessing) {
        log.info('Triggering parse-run-list edge function from processing screen...');
        // Fire async — polling loop drives progress. On error, immediately surface it.
        supabase.functions.invoke('parse-run-list', {
          body: { run_list_id: runListId },
        }).then(async ({ data, error }) => {
          if (!error) return;

          // Extract the real error message from the edge function response body.
          // error.message is always the generic "Edge Function returned a non-2xx status code"
          // which is not useful. The actual message is in error.context.json().error.
          let realMsg = error.message || 'Failed to start file parsing.';
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === 'function') {
              const body = await ctx.json();
              if (body?.error) realMsg = body.error;
            }
          } catch { /* ignore — use generic message */ }

          log.error('Parse edge function async error', realMsg);

          // Update DB so the polling loop surfaces the correct error message.
          // await so this can't be silently dropped before the next poll fires.
          await (supabase as any).from('auction_run_lists')
            .update({
              parse_status: 'failed',
              parse_error: realMsg,
              status: 'failed',
            })
            .eq('id', runListId);
        });
      }

      // Step 1 — Reading file / parsing
      setCurrentStep(1);
      setProgressPercent(10);

      let parsed = false;
      let pollCount = 0;
      // Sentinel — intentionally does not match any real parse_status value (including null→'').
      // This ensures the first poll always resets staleCount instead of starting the clock early.
      let lastStatus = '__pending__';
      let staleCount = 0;

      while (!cancelled && !parsed) {
        await new Promise(r => setTimeout(r, 1500));
        if (cancelled) return;
        pollCount++;

        if (pollCount > MAX_POLL_COUNT) {
          await (supabase as any).from('auction_run_lists')
            .update({ parse_status: 'failed', parse_error: 'Processing timed out.', status: 'failed' })
            .eq('id', runListId);
          fail('Processing timed out after 15 minutes. The file may be too large or complex — try exporting to CSV.', 'Reading file');
          return;
        }

        const { data, error } = await (supabase as any)
          .from('auction_run_lists')
          .select('parse_status, parse_error, status')
          .eq('id', runListId)
          .single();
        if (error || !data) continue;

        // Normalise null/undefined to the empty string for comparison
        const currentStatus = data.parse_status || '';

        if (currentStatus === lastStatus) {
          staleCount++;
          // Per-status stale timeouts (all in poll counts; 1 poll ≈ 1.5s):
          //   ''                  → 80 polls = 2 min  (edge fn hasn't started yet — wait for it)
          //   detecting_file_type → 60 polls = 90s    (edge fn wall-clock limit is 60s)
          //   parsing_vehicles    → 120 polls = 3 min (large CSV/spreadsheet can be slow)
          //   queued_for_ocr      → 480 polls = 12 min (OCR jobs are long-running)
          //   ocr_processing      → 480 polls = 12 min (same reason)
          //   anything else       → 80 polls = 2 min
          const staleLimit =
            currentStatus === 'detecting_file_type' ? 60 :
            currentStatus === 'parsing_vehicles'    ? 120 :
            ['queued_for_ocr', 'ocr_processing'].includes(currentStatus) ? 480 : 80;

          if (staleCount > staleLimit) {
            const stallMsg = !currentStatus
              ? 'Could not start file processing. The file may be too large or the server was busy — please try again.'
              : 'Processing stalled — the file may have timed out. Try a CSV or Excel export.';
            await (supabase as any).from('auction_run_lists')
              .update({ parse_status: 'failed', parse_error: stallMsg, status: 'failed' })
              .eq('id', runListId);
            fail(stallMsg, 'Reading file');
            return;
          }
        } else {
          staleCount = 0;
          lastStatus = currentStatus;
        }

        // Large image PDF: client-driven parallel OCR
        if (data.parse_status === 'queued_for_ocr') {
          let pageCount = 1;
          try {
            const meta = JSON.parse(data.parse_error || '{}');
            pageCount = meta.page_count || 1;
          } catch { /* ignore */ }

          const ocrSuccess = await runClientDrivenOCR(pageCount);
          if (!ocrSuccess || cancelled) return;
          parsed = true;
          continue;
        }

        if (data.parse_status === 'failed') {
          await (supabase as any).from('auction_run_lists').update({ status: 'failed' }).eq('id', runListId);
          fail(data.parse_error || 'Run list parsing failed', 'Reading file');
          return;
        }
        if (data.parse_status === 'completed') {
          setProgressPercent(75);
          parsed = true;
        }
      }
      if (cancelled) return;

      // Get vehicle count
      const { count: vehicleCount } = await (supabase as any)
        .from('auction_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('run_list_id', runListId);
      
      if (vehicleCount) setVehiclesFound(vehicleCount);

      // Step 2 — Enrich vehicles (NHTSA vPIC + CarQuery) — non-fatal
      setCurrentStep(2);
      setProgressPercent(77);
      {
        const { error: enrichErr } = await supabase.functions.invoke('enrich-vehicles', {
          body: { run_list_id: runListId },
        });
        if (enrichErr) log.warn('Enrichment step warning', enrichErr.message);
      }
      if (cancelled) return;
      setProgressPercent(80);

      // Step 3 — Scoring (classify, profit engine, scoring)
      setCurrentStep(3);
      setProgressPercent(82);

      setCurrentStep(4);
      setProgressPercent(85);

      const scoringResult = await runRunListScoringPipeline(runListId);
      if (cancelled) return;

      for (const warning of scoringWarnings(scoringResult)) {
        log.warn('Scoring pipeline warning', warning);
      }

      const scoringFatal = firstFatalScoringError(scoringResult);
      if (scoringFatal) {
        fail(scoringFatal, 'Scoring opportunities');
        return;
      }

      setCurrentStep(5);
      setProgressPercent(93);

      // Step 5 — Build buy list
      setCurrentStep(5);
      setProgressPercent(94);

      {
        let { data: bl, error: blErr } = await (supabase as any)
          .from('buy_lists')
          .select('id')
          .eq('run_list_id', runListId)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (blErr) { fail(blErr.message, 'Building buy list'); return; }

        if (!bl) {
          const { data: newBl, error: insErr } = await (supabase as any)
            .from('buy_lists')
            .insert({ run_list_id: runListId, organization_id: organizationId, name: 'Buy List' })
            .select()
            .single();
          if (insErr) { fail(insErr.message, 'Building buy list'); return; }
          bl = newBl;
        }

        if (bl) {
          const { error: genErr } = await supabase.rpc('generate_buy_list_from_profit', { p_run_list_id: runListId });
          if (genErr) { fail(genErr.message, 'Building buy list'); return; }
        }
      }
      if (cancelled) return;
      setProgressPercent(100);

      await new Promise(r => setTimeout(r, 600));
      await (supabase as any).from('auction_run_lists').update({ status: 'ready' }).eq('id', runListId);
      toast.success('Buy List is ready!');
      navigate(`/app/buy-list?run_list_id=${runListId}`);
    };

    run();
    return () => { cancelled = true; };
  }, [runListId, organizationId, navigate, fail, runClientDrivenOCR]);

  const tip = (FUN_FACTS[displayPhase] ?? FUN_FACTS[0])[funFactIndex];

  if (errorMessage) {
    const isPdfError = errorMessage.toLowerCase().includes('pdf') || errorMessage.toLowerCase().includes('extract');
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background px-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-8">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">Processing failed</h2>
        <p className="text-base text-muted-foreground mb-6 max-w-md text-center leading-relaxed">{errorMessage}</p>
        {isPdfError && (
          <div className="text-sm text-muted-foreground mb-6 max-w-md text-center space-y-1">
            <p className="font-medium">What you can try:</p>
            <ul className="list-disc list-inside text-left space-y-0.5">
              <li>Export the PDF to Excel or CSV using Excel or Google Sheets</li>
              <li>Ensure the file is not password-protected</li>
              <li>If this is a scanned PDF, try a clearer scan</li>
            </ul>
          </div>
        )}
        <Button onClick={onError} variant="outline" size="lg">Return to Dashboard</Button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col items-center bg-background px-4 sm:px-6 py-6 sm:py-10 overflow-y-auto">
      {/* Top: logo + phase stepper */}
      <div className="flex flex-col items-center w-full mb-2 shrink-0">
        <div className="relative mb-6">
          <div className="h-14 w-14 rounded-full border border-primary/15 flex items-center justify-center bg-card shadow-sm">
            <img src={logoImg} alt="LogicLot" className="h-7 w-7 object-contain" />
          </div>
          <svg className="absolute inset-0 h-14 w-14 animate-spin" style={{ animationDuration: '2.5s' }} viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="26" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeDasharray="40 124" strokeLinecap="round" />
          </svg>
        </div>
        <PhaseStepper phase={displayPhase} />
      </div>

      {/* Phase content — key=displayPhase so fade-in fires on actual display change */}
      <div key={displayPhase} className="flex flex-col items-center w-full flex-grow min-h-fit animate-in fade-in slide-in-from-bottom-3 duration-500 pb-8">
        {displayPhase === 0 && (
          <PhaseReading
            pagesProcessed={pagesProcessed}
            totalPages={totalPages}
            vehiclesFound={vehiclesFound}
            progressPercent={progressPercent}
            tip={tip}
            forceComplete={forceComplete}
          />
        )}
        {displayPhase === 1 && (
          <PhaseDecoding
            vehiclesFound={vehiclesFound}
            tip={tip}
            forceComplete={forceComplete}
          />
        )}
        {displayPhase === 2 && (
          <PhaseAnalyzing
            vehiclesFound={vehiclesFound}
            progressPercent={progressPercent}
            currentStep={currentStep}
            tip={tip}
            forceComplete={forceComplete}
          />
        )}
        {displayPhase === 3 && (
          <PhaseBuilding
            vehiclesFound={vehiclesFound}
            progressPercent={progressPercent}
            tip={tip}
            forceComplete={forceComplete}
          />
        )}
      </div>
    </div>,
    document.body
  );
};

export default ProcessingScreen;
