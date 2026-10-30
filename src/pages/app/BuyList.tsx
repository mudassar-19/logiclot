import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { AlertTriangle, CheckCircle, FileSpreadsheet, Search, ShieldAlert, Sparkles, MapPin, ChevronRight, ArrowLeft, DollarSign, TrendingUp, BarChart3, MapPinned, SlidersHorizontal, RefreshCw, Loader2, Lightbulb, Wrench, Info, HelpCircle, Wand2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddToBidMapDialog from '@/components/buylist/AddToBidMapDialog';
import BuyListPreferencesModal from '@/components/buylist/BuyListPreferencesModal';
import { generateDemoBuyListVehicles, type DemoVehicle } from '@/lib/demoBuyListData';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { fetchRunLists, type RunListRow } from '@/lib/runListCache';
import { normalizeVehicleTypeSelectionForSave } from '@/lib/vehicleTypes';
import {
  firstFatalScoringError,
  runRunListScoringPipeline,
  scoringWarnings,
} from '@/lib/runListScoringPipeline';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/ui/TablePagination';

interface AuctionVehicle {
  id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  lane: string | null;
  run_order: number | null;
  lot_number: string | null;
  cr_score: number | null;
  has_cr: boolean;
  estimated_profit: number | null;
  estimated_retail_value: number | null;
  estimated_recon_cost: number | null;
  estimated_transport_cost: number | null;
  estimated_auction_fee: number | null;
  total_estimated_cost: number | null;
  recommended_max_bid: number | null;
  ai_recommendation: string | null;
  ai_summary: string | null;
  ai_insight: string | null;
  scoring_reasons: string[] | null;
  risk_flags: string[] | null;
  profit_score: number | null;
  mmr_value: number | null;
  current_bid: number | null;
  buy_now: number | null;
  price_estimate: number | null;
  seller_type: string | null;
  title_status: string | null;
  condition_notes: string | null;
  recommendation_reason: string | null;
  vehicle_type: string | null;
  recon_base: number | null;
  recon_cr_adj: number | null;
  recon_age_adj: number | null;
  recon_mileage_adj: number | null;
  recon_type_adj: number | null;
  recon_brand_adj: number | null;
  recon_risk_adj: number | null;
  recon_override: number | null;
  // Retail breakdown
  retail_base_market_value?: number | null;
  retail_cr_adjustment?: number | null;
  retail_mileage_adjustment?: number | null;
  retail_dealer_margin?: number | null;
  retail_market_position?: 'Above Market' | 'At Market' | 'Below Market' | null;
  // Market comps
  retail_data_source?: string | null;
  market_comp_count?: number | null;
  market_avg_price?: number | null;
  market_avg_mileage?: number | null;
  // Market velocity
  avg_days_to_sell?: number | null;
  market_day_supply?: number | null;
  // Structured damage/condition (IAA)
  damage_location?: string | null;
  damage_type?: string | null;
  drive_condition?: string | null;
  body_condition?: string | null;
  key_status?: string | null;
  recon_damage_adj?: number | null;
  run_list_id: string;
  is_bank_lendable?: boolean | null;
  detected_flags?: string[];
  confirmed_flags?: string[];
  dismissed_flags?: string[];
  announcement_raw_text?: string | null;
}

interface FilterTransparency {
  totalInRunList: number;
  brandMatches: number;
  excludedByBrand: number;
  excludedByPrice: number;
  excludedByCR: number;
  excludedByMileage: number;
  excludedByYear: number;
  excludedByType: number;
  excludedByRisk: number;
  excludedByRecon: number;
  excludedByNegativeProfit: number;
  eligible: number;
}

type SortKey = 'profit' | 'lane' | 'run_order' | 'cr_score' | 'mileage';

const fmt = (n: number) => `$${n.toLocaleString()}`;

const formatPositiveMoney = (value: number | null | undefined) => {
  if (value == null || value <= 0) return null;
  return fmt(value);
};

const getRetailDisplayValue = (vehicle: Pick<AuctionVehicle, 'estimated_retail_value' | 'price_estimate' | 'mmr_value'>) =>
  vehicle.estimated_retail_value ?? vehicle.price_estimate ?? vehicle.mmr_value ?? null;

const normalizeAiRecommendation = (rec: string | null | undefined): string | null => {
  if (!rec) return null;
  const key = rec.trim().toLowerCase();
  if (key === 'strong buy') return 'Strong Buy';
  if (key === 'buy') return 'Buy';
  if (key === 'possible buy') return 'Possible Buy';
  if (key === 'pass') return 'Pass';
  if (key === 'review') return 'Review';
  return rec;
};

const recBadge = (rec: string | null) => {
  switch (normalizeAiRecommendation(rec)) {
    case 'Strong Buy':
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs">Strong Buy</Badge>;
    case 'Buy':
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 text-xs">Buy</Badge>;
    case 'Possible Buy':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">Possible Buy</Badge>;
    case 'Pass':
      return <Badge className="bg-muted text-muted-foreground border-0 text-xs">Pass</Badge>;
    case 'Review':
      return <Badge variant="outline" className="text-xs">Review</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{rec || 'Pending'}</Badge>;
  }
};

const getWholesaleBasis = (vehicle: Pick<AuctionVehicle, 'buy_now' | 'current_bid' | 'price_estimate' | 'mmr_value'>) =>
  vehicle.buy_now ?? vehicle.current_bid ?? vehicle.price_estimate ?? vehicle.mmr_value ?? 0;

const buildRecommendationExplanation = (v: AuctionVehicle): string[] => {
  const reasons: string[] = [];
  const wholesale = getWholesaleBasis(v);
  const retail = v.estimated_retail_value ?? 0;
  const recon = v.estimated_recon_cost ?? 0;
  const fees = v.estimated_auction_fee ?? 500;
  const profit = v.estimated_profit ?? 0;
  const margin = retail > 0 ? ((profit / retail) * 100) : 0;

  if (profit !== 0) {
    reasons.push(`Projected profit: ${fmt(profit)} (${margin.toFixed(1)}% margin)`);
    if (profit < 0) reasons.push('⚠️ Negative profit — would lose money at current wholesale');
  }
  if (wholesale > 0 && retail > 0) {
    reasons.push(`Wholesale ref: ${fmt(wholesale)} → Retail est: ${fmt(retail)}`);
  }
  if (v.recommended_max_bid != null) {
    reasons.push(`Max bid: ${formatPositiveMoney(v.recommended_max_bid) ?? '—'}`);
  }
  if (v.cr_score != null) {
    reasons.push(`CR Score: ${v.cr_score.toFixed(1)} → Recon est: ${fmt(recon)}`);
  } else {
    reasons.push(`No CR available → Recon est: ${fmt(recon)} (default)`);
  }
  if (fees > 0) reasons.push(`Auction fee: ${fmt(fees)}`);
  if (v.profit_score != null) reasons.push(`Profit score: ${v.profit_score}/100`);
  if (v.risk_flags && v.risk_flags.length > 0) reasons.push(`Risk: ${v.risk_flags.join(', ')}`);
  return reasons;
};

interface BuyListRunList {
  auction_name: string | null;
  auction_source: string | null;
  auction_date: string | null;
}

interface BuyListSummary {
  id: string;
}

interface DealerZipRow {
  dealer_zip: string | null;
}

type FilterVehicle = Pick<
  AuctionVehicle,
  'id' | 'make' | 'vehicle_type' | 'estimated_profit' | 'cr_score' | 'mileage' | 'year' |
  'estimated_recon_cost' | 'ai_recommendation' | 'buy_now' | 'mmr_value' | 'price_estimate' |
  'current_bid' | 'title_status' | 'risk_flags'
>;

interface PreferenceQueryRow {
  no_brand_preference?: boolean | null;
  preferred_brands?: string[] | null;
  excluded_brands?: string[] | null;
  vehicle_types?: string[] | null;
  min_price?: number | null;
  max_price?: number | null;
  min_year?: number | null;
  max_year?: number | null;
  min_mileage?: number | null;
  max_mileage?: number | null;
  min_cr_score?: number | null;
  allow_no_cr?: boolean | null;
  max_recon_cost?: number | null;
  allow_salvage?: boolean | null;
  allow_frame_damage?: boolean | null;
  allow_tmu?: boolean | null;
  target_profit?: number | null;
}

const FLAG_DEFINITIONS = [
  { id: 'salvage', label: 'Salvage Title', description: 'Apply Salvage status. Reduces retail value estimate by 30%.' },
  { id: 'rebuilt', label: 'Rebuilt Title', description: 'Apply Rebuilt status. Reduces retail value estimate by 25%.' },
  { id: 'major_accident', label: 'Major Accident', description: 'Apply Major Accident status. Reduces retail value estimate by 10%.' },
  { id: 'lemon', label: 'Lemon / Buyback', description: 'Apply Lemon/Buyback status. Reduces retail value estimate by 15%.' },
  { id: 'tmu', label: 'True Miles Unknown', description: 'Apply TMU status. Reduces retail value estimate by 25%.' },
];

const log = logger('BuyList');

// ─── Module-level session cache ───────────────────────────────────────────────
// Persists for the lifetime of the browser tab. Keyed by run_list_id.
// Stores the heavy auction_vehicles payload so navigating back to the same
// run list is instant — no additional Supabase calls.
interface RunListCache {
  vehicles: AuctionVehicle[];
  runList: BuyListRunList;
  buyListId: string | null;
  dealerZip: string;
  fetchedAt: number; // ms epoch
}

const SESSION_CACHE = new Map<string, RunListCache>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — auto-stale; bust immediately after Regenerate

/** Call after Regenerate or recon override to force a fresh fetch on next open. */
function invalidateRunListCache(runListId: string) {
  SESSION_CACHE.delete(runListId);
}

/** Prevents duplicate concurrent fetches when React StrictMode double-invokes effects. */
const IN_FLIGHT = new Map<string, Promise<RunListCache>>();

const BuyList = () => {
  const { user, organization } = useAuth();
  const { isDemoMode: onboardingDemoMode, isOnboarding, reconClickRef, retailClickRef } = useOnboarding();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const runListId = searchParams.get('run_list_id');

  const [runLists, setRunLists] = useState<RunListRow[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [runList, setRunList] = useState<BuyListRunList | null>(null);
  const [vehicles, setVehicles] = useState<AuctionVehicle[]>([]);
  const [buyList, setBuyList] = useState<BuyListSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('profit');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRec, setFilterRec] = useState<string>('all');
  const [filterHasCR, setFilterHasCR] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<AuctionVehicle | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bidMapDialogOpen, setBidMapDialogOpen] = useState(false);
  const [retailDetailVehicle, setRetailDetailVehicle] = useState<AuctionVehicle | null>(null);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [filterTransparency, setFilterTransparency] = useState<FilterTransparency | null>(null);
  const [dealerZip, setDealerZip] = useState('');
  const [maxMileagePref, setMaxMileagePref] = useState(0);
  const [activePrefs, setActivePrefs] = useState<PreferenceQueryRow | null>(null);
  const [reconEditVehicle, setReconEditVehicle] = useState<AuctionVehicle | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [updatingAnnouncements, setUpdatingAnnouncements] = useState(false);
  const [targetProfit, setTargetProfit] = useState<number | null>(null);

  // Demo / onboarding mode
  const [demoMode, setDemoMode] = useState(false);
  const hasDealerZip = dealerZip.trim().length > 0;

  const startDemoMode = useCallback(() => {
    const currentYear = new Date().getFullYear();
    const demoVehicles = (generateDemoBuyListVehicles(150) as unknown as AuctionVehicle[]).map(v => {
      const vehicleAge = v.year ? (currentYear - v.year) : 0;
      const vehicleMiles = v.mileage ?? 0;
      const retailVal = v.estimated_retail_value ?? 0;
      const ts = (v.title_status ?? '').toLowerCase();
      const hasFrameDamage = (v.risk_flags ?? []).some(rf => rf.toLowerCase().includes('frame'));
      
      let isLendable = true;
      if (ts.includes('salvage') || ts.includes('rebuilt') || ts.includes('other')) {
        isLendable = false;
      } else if (vehicleAge > 10) {
        isLendable = false;
      } else if (vehicleMiles > 150000) {
        isLendable = false;
      } else if (retailVal < 4000) {
        isLendable = false;
      } else if (hasFrameDamage) {
        isLendable = false;
      }

      // Populate detected flags for demo
      const detected_flags: string[] = [];
      if (ts.includes('salvage')) {
        detected_flags.push('salvage');
      } else if (ts.includes('rebuilt')) {
        detected_flags.push('rebuilt');
      }
      if ((v.risk_flags ?? []).some(rf => rf.toLowerCase().includes('accident') || rf.toLowerCase().includes('damage'))) {
        detected_flags.push('major_accident');
      }
      if ((v.risk_flags ?? []).some(rf => rf.toLowerCase().includes('lemon') || rf.toLowerCase().includes('buyback'))) {
        detected_flags.push('lemon');
      }
      if ((v.risk_flags ?? []).some(rf => rf.toLowerCase().includes('tmu') || rf.toLowerCase().includes('miles unknown'))) {
        detected_flags.push('tmu');
      }

      return {
        ...v,
        is_bank_lendable: isLendable,
        detected_flags,
        confirmed_flags: [],
        dismissed_flags: [],
        announcement_raw_text: detected_flags.length > 0 ? `Simulated announcement: ${detected_flags.join(', ')}` : null
      };
    });

    setVehicles(demoVehicles);
    setDemoMode(true);
    setLoading(false);
    setTargetProfit(3000);
    setRunList({ auction_name: 'Demo Auction — Manheim Dallas', auction_source: 'Manheim', auction_date: new Date().toISOString().split('T')[0] });
    setFilterTransparency({
      totalInRunList: 280, brandMatches: 210, excludedByBrand: 4, excludedByPrice: 15, excludedByCR: 8,
      excludedByMileage: 12, excludedByYear: 5, excludedByType: 10, excludedByRisk: 3,
      excludedByRecon: 7, excludedByNegativeProfit: 20, eligible: 150,
    });
    setTimeout(() => {
      // Onboarding is now handled by OnboardingOrchestrator via context
    }, 600);
  }, []);

  const handleUpdateAnnouncements = async (
    vehicle: AuctionVehicle,
    nextConfirmed: string[],
    nextDismissed: string[]
  ) => {
    setUpdatingAnnouncements(true);
    try {
      if (demoMode) {
        const currentYear = new Date().getFullYear();
        const vehicleAge = vehicle.year ? (currentYear - vehicle.year) : 0;
        const vehicleMiles = vehicle.mileage ?? 0;
        
        // Base market value calculation from comps or retail display
        const base = vehicle.retail_base_market_value ?? getRetailDisplayValue(vehicle) ?? 15000;
        
        // Calculate penalty based on confirmed flags
        let titlePenalty = 0;
        if (nextConfirmed.includes('salvage')) {
          titlePenalty = 0.30;
        } else if (nextConfirmed.includes('rebuilt')) {
          titlePenalty = 0.25;
        }

        let stackablePenalty = 0;
        if (nextConfirmed.includes('major_accident')) {
          stackablePenalty += 0.10;
        }
        if (nextConfirmed.includes('lemon')) {
          stackablePenalty += 0.15;
        }
        if (nextConfirmed.includes('tmu')) {
          stackablePenalty += 0.25;
        }

        const totalPenalty = titlePenalty + stackablePenalty;
        
        // Compute cr adjustment like in update-retail-values function
        let crAdj = 0;
        const cr = vehicle.cr_score;
        if (cr == null) crAdj = -Math.round(base * 0.02);
        else if (cr >= 4.5) crAdj = Math.round(base * 0.04);
        else if (cr >= 4.0) crAdj = Math.round(base * 0.02);
        else if (cr >= 3.5) crAdj = 0;
        else if (cr >= 3.0) crAdj = -Math.round(base * 0.02);
        else crAdj = -Math.round(base * 0.04);

        const computedRetail = base + crAdj;
        const finalRetail = Math.max(Math.round(base * 0.65), Math.min(Math.round(base * 1.40), Math.round(computedRetail * (1 - totalPenalty))));
        
        // title_status update
        let titleStatus = vehicle.title_status ?? 'clean';
        if (nextConfirmed.includes('salvage')) {
          titleStatus = 'Salvage';
        } else if (nextConfirmed.includes('rebuilt')) {
          titleStatus = 'Rebuilt';
        } else if (nextConfirmed.length === 0) {
          titleStatus = 'clean';
        }

        // isLendable update
        const hasFrameDamage = nextConfirmed.includes('major_accident') || (vehicle.damage_location && vehicle.damage_location.toLowerCase().includes('frame'));
        let isLendable = true;
        if (titleStatus.toLowerCase().includes('salvage') || titleStatus.toLowerCase().includes('rebuilt') || titleStatus.toLowerCase().includes('other')) {
          isLendable = false;
        } else if (vehicleAge > 10) {
          isLendable = false;
        } else if (vehicleMiles > 150000) {
          isLendable = false;
        } else if (finalRetail < 4000) {
          isLendable = false;
        } else if (hasFrameDamage) {
          isLendable = false;
        }

        // Recompute profit and max bid
        const mmrBase = vehicle.buy_now ?? vehicle.current_bid ?? vehicle.price_estimate ?? vehicle.mmr_value ?? 0;
        const acquisitionCost = mmrBase;
        const estRecon = vehicle.estimated_recon_cost ?? 1350;
        const estFee = vehicle.estimated_auction_fee ?? 500;
        const targetMargin = Math.round(finalRetail * 0.15);
        const updatedMaxBid = Math.max(0, Math.round(finalRetail - targetMargin - estRecon - estFee));
        const updatedProfit = Math.max(0, Math.round(finalRetail - acquisitionCost - estRecon - estFee));

        const updatedVehicle: AuctionVehicle = {
          ...vehicle,
          confirmed_flags: nextConfirmed,
          dismissed_flags: nextDismissed,
          estimated_retail_value: finalRetail,
          title_status: titleStatus,
          is_bank_lendable: isLendable,
          estimated_profit: updatedProfit,
          recommended_max_bid: updatedMaxBid > 0 ? updatedMaxBid : null,
        };

        setVehicles(prev => prev.map(v => v.id === vehicle.id ? updatedVehicle : v));
        setSelectedVehicle(updatedVehicle);
        toast.success('Announcements updated (Demo Mode)');
      } else {
        const syntheticKey = vehicle.vin ? vehicle.vin.trim().toUpperCase() : `NO_VIN_${vehicle.lot_number || vehicle.id}`;
        
        // 1. Upsert to vehicle_announcements
        const { error: upsertErr } = await supabase
          .from('vehicle_announcements')
          .upsert({
            run_list_id: vehicle.run_list_id,
            vin: syntheticKey,
            source: 'dealer_ui',
            detected_flags: vehicle.detected_flags ?? [],
            confirmed_flags: nextConfirmed,
            dismissed_flags: nextDismissed
          }, { onConflict: 'run_list_id,vin' });

        if (upsertErr) {
          log.error('Failed to upsert vehicle announcement', upsertErr);
          toast.error('Failed to save announcement changes');
          return;
        }

        // 2. Invoke update-retail-values edge function to recompute prices
        const { error: invokeErr } = await supabase.functions.invoke('update-retail-values', {
          body: { run_list_id: vehicle.run_list_id }
        });
        if (invokeErr) {
          log.error('Failed to invoke update-retail-values', invokeErr);
          toast.error('Failed to recalculate retail values');
          return;
        }

        // 3. Finalize run list scoring (updates ai recommendations, etc.)
        const { error: finalizeErr } = await supabase.rpc('finalize_run_list_scoring', {
          p_run_list_id: vehicle.run_list_id
        });
        if (finalizeErr) {
          log.error('Failed to finalize scoring', finalizeErr);
          toast.error('Failed to finalize scoring adjustments');
          return;
        }

        // 4. Fetch the updated row from database
        const { data: updatedVeh, error: fetchErr } = await supabase
          .from('auction_vehicles')
          .select('*')
          .eq('id', vehicle.id)
          .single();

        if (fetchErr || !updatedVeh) {
          log.error('Failed to fetch updated vehicle', fetchErr);
          toast.error('Failed to reload updated vehicle data');
          return;
        }

        // 5. Merge announcement data
        const mergedVehicle: AuctionVehicle = {
          ...updatedVeh,
          detected_flags: vehicle.detected_flags ?? [],
          confirmed_flags: nextConfirmed,
          dismissed_flags: nextDismissed,
          announcement_raw_text: vehicle.announcement_raw_text ?? null
        };

        // 6. Update local state
        setVehicles(prev => prev.map(v => v.id === vehicle.id ? mergedVehicle : v));
        setSelectedVehicle(mergedVehicle);
        toast.success('Announcements updated successfully');
      }
    } catch (err: unknown) {
      log.error('Failed in handleUpdateAnnouncements', err);
      toast.error('An unexpected error occurred while saving.');
    } finally {
      setUpdatingAnnouncements(false);
    }
  };

  // Auto-start demo if ?demo=true or onboarding is active
  useEffect(() => {
    if ((searchParams.get('demo') === 'true' || onboardingDemoMode) && !demoMode) {
      startDemoMode();
    }
  }, [searchParams, demoMode, startDemoMode, onboardingDemoMode]);

  // Wire up recon/retail click refs for onboarding require-click steps
  // Wire up recon/retail click refs for onboarding require-click steps
  // (uses vehicles directly to avoid stale closure on `filtered`)
  useEffect(() => {
    if (reconClickRef) reconClickRef.current = () => { if (vehicles.length > 0) setReconEditVehicle(vehicles[0]); };
    if (retailClickRef) retailClickRef.current = () => { if (vehicles.length > 0) setRetailDetailVehicle(vehicles[0]); };
  }, [vehicles, reconClickRef, retailClickRef]);

  // Build active filter summary + filter transparency from override or default prefs.
  // Uses already-loaded `vehicles` state — no second round-trip to Supabase.
  useEffect(() => {
    if (!organization?.id || !runListId) return;
    // Wait until vehicles are loaded before computing filter transparency
    if (vehicles.length === 0) return;
    const loadFilters = async () => {
      // Reuse the vehicles already in state — avoids a redundant DB round-trip
      const allVeh: FilterVehicle[] = vehicles;

      let activeBrands: string[] = [];
      let excludedBrands: string[] = [];
      let activeTypes: string[] = [];
      let minPrice = 0;
      let maxPrice = 0;
      let minYear = 0;
      let maxYear = 9999;
      let minMileage = 0;
      let maxMileage = 0;
      let minCr = 0;
      let allowNoCr = true;
      let maxRecon = 0;
      let allowSalvage = true;
      let allowFrameDamage = true;
      let allowTmu = true;
      let source = 'Default Preferences';
      let targetProfitVal: number | null = null;
      let currentPrefs: PreferenceQueryRow | null = null;

      const blId = buyList?.id;
      if (blId) {
        const { data: override } = await supabase
          .from('buy_list_override_preferences')
          .select('*')
          .eq('buy_list_id', blId)
          .maybeSingle();
        if (override) {
          source = 'Buy List Override';
          const typedOverride = override as PreferenceQueryRow;
          currentPrefs = typedOverride;
          activeBrands = typedOverride.no_brand_preference ? [] : (typedOverride.preferred_brands ?? []);
          excludedBrands = typedOverride.excluded_brands ?? [];
          activeTypes = normalizeVehicleTypeSelectionForSave(typedOverride.vehicle_types ?? []);
          minPrice = typedOverride.min_price ?? 0;
          maxPrice = typedOverride.max_price ?? 0;
          minYear = typedOverride.min_year ?? 0;
          maxYear = typedOverride.max_year ?? 9999;
          minMileage = typedOverride.min_mileage ?? 0;
          maxMileage = typedOverride.max_mileage ?? 0;
          minCr = typedOverride.min_cr_score ?? 0;
          allowNoCr = typedOverride.allow_no_cr ?? true;
          maxRecon = typedOverride.max_recon_cost ?? 0;
          allowSalvage = typedOverride.allow_salvage ?? false;
          allowFrameDamage = typedOverride.allow_frame_damage ?? false;
          allowTmu = typedOverride.allow_tmu ?? true;
          targetProfitVal = typedOverride.target_profit ?? null;
        }
      }

      if (source === 'Default Preferences') {
        const { data: dp } = await supabase
          .from('dealer_preferences')
          .select('*')
          .eq('organization_id', organization.id)
          .maybeSingle();
        if (dp) {
          const typedPrefs = dp as PreferenceQueryRow;
          currentPrefs = typedPrefs;
          activeBrands = typedPrefs.preferred_brands ?? [];
          excludedBrands = typedPrefs.excluded_brands ?? [];
          activeTypes = normalizeVehicleTypeSelectionForSave(typedPrefs.vehicle_types ?? []);
          minPrice = typedPrefs.min_price ?? 0;
          maxPrice = typedPrefs.max_price ?? 0;
          minYear = typedPrefs.min_year ?? 0;
          maxYear = typedPrefs.max_year ?? 9999;
          minMileage = typedPrefs.min_mileage ?? 0;
          maxMileage = typedPrefs.max_mileage ?? 0;
          minCr = typedPrefs.min_cr_score ?? 0;
          allowNoCr = typedPrefs.allow_no_cr ?? true;
          maxRecon = typedPrefs.max_recon_cost ?? 0;
          allowSalvage = typedPrefs.allow_salvage ?? false;
          allowFrameDamage = typedPrefs.allow_frame_damage ?? false;
          allowTmu = typedPrefs.allow_tmu ?? true;
          targetProfitVal = typedPrefs.target_profit ?? null;
        }
      }

      const f: Record<string, string> = { source };
      if (activeBrands.length) f['Brand'] = activeBrands.join(', ');
      if (excludedBrands.length) f['Excluded Brands'] = excludedBrands.join(', ');
      if (activeTypes.length) f['Types'] = activeTypes.join(', ');
      if (minPrice > 0) f['Min Price'] = `$${Number(minPrice).toLocaleString()}`;
      if (maxPrice > 0) f['Max Price'] = `$${Number(maxPrice).toLocaleString()}`;
      if (minYear > 0 || maxYear < 9999) f['Year'] = `${minYear || '—'}–${maxYear >= 9999 ? '—' : maxYear}`;
      if (minMileage > 0) f['Min Miles'] = Number(minMileage).toLocaleString();
      if (maxMileage > 0) f['Max Miles'] = Number(maxMileage).toLocaleString();
      if (minCr > 0) f['Min CR'] = minCr.toString();
      if (maxRecon > 0) f['Max Recon'] = `$${Number(maxRecon).toLocaleString()}`;
      setActiveFilters(f);
      setMaxMileagePref(maxMileage);
      setTargetProfit(targetProfitVal);
      setActivePrefs(currentPrefs);

      {
        const brandUpper = activeBrands.map((b) => b.toUpperCase());
        const excludedBrandUpper = excludedBrands.map((b) => b.toUpperCase());
        const brandMatches = activeBrands.length > 0
          ? allVeh.filter((v) => brandUpper.includes((v.make ?? '').toUpperCase()))
          : allVeh;
        const getPrice = (v: FilterVehicle) => v.buy_now ?? v.mmr_value ?? v.price_estimate ?? v.current_bid ?? 0;
        const hasDisallowedRisk = (v: FilterVehicle) => {
          const riskFlags: string[] = Array.isArray(v.risk_flags) ? v.risk_flags : [];
          const titleStatus = (v.title_status ?? '').toLowerCase();
          return (!allowSalvage && titleStatus.includes('salvage'))
            || (!allowFrameDamage && riskFlags.includes('Frame damage'))
            || (!allowTmu && (titleStatus.includes('tmu') || riskFlags.includes('TMU')));
        };

        let excBrand = 0, excPrice = 0, excCR = 0, excMileage = 0, excYear = 0, excType = 0, excRisk = 0, excRecon = 0, excNegProfit = 0;

        for (const v of brandMatches) {
          const price = getPrice(v);
          if (excludedBrandUpper.length > 0 && excludedBrandUpper.includes((v.make || '').toUpperCase())) { excBrand++; continue; }
          if (minPrice > 0 && price > 0 && price < minPrice) { excPrice++; continue; }
          if (maxPrice > 0 && price > maxPrice) { excPrice++; continue; }
          if (minYear > 0 && v.year && v.year < minYear) { excYear++; continue; }
          if (maxYear < 9999 && v.year && v.year > maxYear) { excYear++; continue; }
          if (minMileage > 0 && v.mileage != null && v.mileage < minMileage) { excMileage++; continue; }
          if (maxMileage > 0 && (v.mileage || 0) > maxMileage) { excMileage++; continue; }
          if (minCr > 0 && v.cr_score != null && v.cr_score < minCr) { excCR++; continue; }
          if (minCr > 0 && v.cr_score == null && !allowNoCr) { excCR++; continue; }
          // hasListingPrice: true only when the auction CSV had a price column (buy_now/price_estimate/current_bid).
          // mmr_value is from enrichment and does NOT count as a listing price.
          const hasListingPrice = (v.buy_now || 0) > 0 || (v.price_estimate || 0) > 0 || (v.current_bid || 0) > 0;
          if (activeTypes.length > 0 && v.vehicle_type && v.vehicle_type !== 'Other' && !activeTypes.includes(v.vehicle_type)) { excType++; continue; }
          if (hasDisallowedRisk(v)) { excRisk++; continue; }
          if (maxRecon > 0 && hasListingPrice && (v.estimated_recon_cost || 0) > maxRecon) { excRecon++; continue; }
          if (hasListingPrice && (v.estimated_profit || 0) < 0) { excNegProfit++; continue; }
        }

        setFilterTransparency({
          totalInRunList: allVeh.length,
          brandMatches: brandMatches.length,
          excludedByBrand: excBrand,
          excludedByPrice: excPrice,
          excludedByCR: excCR,
          excludedByMileage: excMileage,
          excludedByYear: excYear,
          excludedByType: excType,
          excludedByRisk: excRisk,
          excludedByRecon: excRecon,
          excludedByNegativeProfit: excNegProfit,
          eligible: brandMatches.length - excBrand - excPrice - excCR - excMileage - excYear - excType - excRisk - excRecon - excNegProfit,
        });
      }
    };
    loadFilters();
  }, [organization?.id, buyList?.id, runListId, vehicles]);

  useEffect(() => {
    if (runListId || !organization?.id) return;
    setPickerLoading(true);
    // Use shared cache — instant if Dashboard already loaded the list
    fetchRunLists(organization.id).then((data) => {
      setRunLists(data);
      setPickerLoading(false);
    }).catch(() => setPickerLoading(false));
  }, [organization?.id, runListId]);


  useEffect(() => {
    if (vehicles.length === 0) return;
    if (filterRec !== 'recommended') return;
    const hasRec = vehicles.some(v =>
      ['Strong Buy', 'Buy', 'Possible Buy'].includes(v.ai_recommendation ?? '')
    );
    if (!hasRec) setFilterRec('all');
  }, [vehicles, filterRec]);

  // Tracks the run list id that is currently loading so StrictMode double-invocations
  // and fast navigation don't trigger duplicate fetches.
  const loadingForRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    if (!runListId || !organization?.id) return;

    // ── Cache hit ──────────────────────────────────────────────────────────────
    const cached = SESSION_CACHE.get(runListId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      log.info('BuyList cache hit', { runListId });
      setVehicles(cached.vehicles);
      setRunList(cached.runList);
      setDealerZip(cached.dealerZip);
      if (cached.buyListId) setBuyList({ id: cached.buyListId });
      setLoading(false);
      return;
    }

    // ── Deduplicate in-flight requests ────────────────────────────────────────
    // If another invocation is already fetching this run list, wait for it.
    if (IN_FLIGHT.has(runListId)) {
      log.info('BuyList joining in-flight fetch', { runListId });
      try {
        const result = await IN_FLIGHT.get(runListId)!;
        setVehicles(result.vehicles);
        setRunList(result.runList);
        setDealerZip(result.dealerZip);
        if (result.buyListId) setBuyList({ id: result.buyListId });
      } catch { /* already handled by the original fetch */ }
      setLoading(false);
      return;
    }

    // ── Prevent stale renders when the user navigates quickly ─────────────────
    loadingForRef.current = runListId;
    setLoading(true);

    const fetchPromise = (async (): Promise<RunListCache> => {
      const [dealerPrefsRes, rlRes] = await Promise.all([
        supabase
          .from('dealer_preferences')
          .select('dealer_zip')
          .eq('organization_id', organization.id)
          .maybeSingle<DealerZipRow>(),
        supabase
          .from('auction_run_lists')
          .select('auction_name, auction_source, auction_date')
          .eq('id', runListId)
          .single(),
      ]);

      const rl = rlRes.data;
      const dealerZipValue = dealerPrefsRes.data?.dealer_zip ?? '';

      // Fetch all vehicles (paginated, but only once per session)
      const veh = await fetchAllRows<AuctionVehicle>((from, to) =>
        supabase
          .from('auction_vehicles').select('*').eq('run_list_id', runListId)
          .order('profit_score', { ascending: false }).order('lane', { ascending: true }).order('run_order', { ascending: true })
          .range(from, to)
      );

      // Fetch vehicle announcements
      const { data: annData } = await supabase
        .from('vehicle_announcements')
        .select('*')
        .eq('run_list_id', runListId);

      const annMap = new Map<
        string,
        {
          vin: string;
          detected_flags?: string[] | null;
          confirmed_flags?: string[] | null;
          dismissed_flags?: string[] | null;
          raw_text?: string | null;
        }
      >();
      if (annData) {
        for (const ann of annData) {
          annMap.set(ann.vin.toUpperCase(), ann);
        }
      }

      const vehWithAnn = veh.map(v => {
        const syntheticKey = v.vin ? v.vin.trim().toUpperCase() : `NO_VIN_${v.lot_number || v.id}`;
        const ann = annMap.get(syntheticKey);
        return {
          ...v,
          detected_flags: ann?.detected_flags ?? [],
          confirmed_flags: ann?.confirmed_flags ?? [],
          dismissed_flags: ann?.dismissed_flags ?? [],
          announcement_raw_text: ann?.raw_text ?? null,
        };
      });

      // Get or create the buy list record
      let { data: bl } = await supabase
        .from('buy_lists').select('id').eq('run_list_id', runListId)
        .eq('organization_id', organization.id).maybeSingle();

      if (!bl && user?.id) {
        const name = rl?.auction_name ? `${rl.auction_name} Buy List` : 'Buy List';
        const { data: newBl } = await supabase
          .from('buy_lists')
          .insert({ organization_id: organization.id, run_list_id: runListId, name, created_by: user.id })
          .select('id').single();
        bl = newBl;
      }

      const entry: RunListCache = {
        vehicles: vehWithAnn,
        runList: rl ?? { auction_name: null, auction_source: null, auction_date: null },
        buyListId: bl?.id ?? null,
        dealerZip: dealerZipValue,
        fetchedAt: Date.now(),
      };

      // Store in session cache for subsequent visits
      SESSION_CACHE.set(runListId, entry);
      return entry;
    })();

    IN_FLIGHT.set(runListId, fetchPromise);

    try {
      const result = await fetchPromise;
      // Guard against stale renders: skip if user navigated away
      if (loadingForRef.current !== runListId) return;
      setVehicles(result.vehicles);
      setRunList(result.runList);
      setDealerZip(result.dealerZip);
      if (result.buyListId) setBuyList({ id: result.buyListId });
    } catch (err) {
      log.error('loadData failed', err);
    } finally {
      IN_FLIGHT.delete(runListId);
      if (loadingForRef.current === runListId) setLoading(false);
    }
  }, [runListId, organization?.id, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const regenerateBuyList = async () => {
    if (!runListId || !organization?.id) return;
    setRegenerating(true);

    try {
      const { data: bl } = await supabase
        .from('buy_lists').select('id').eq('run_list_id', runListId)
        .eq('organization_id', organization.id).maybeSingle();
      if (bl) {
        await supabase.from('buy_list_items').delete().eq('buy_list_id', bl.id);
      }

      const scoringResult = await runRunListScoringPipeline(runListId, { resetRecommendations: true });

      for (const warning of scoringWarnings(scoringResult)) {
        log.warn('Scoring pipeline warning', warning);
      }

      const scoringFatal = firstFatalScoringError(scoringResult);
      if (scoringFatal) {
        toast.error(scoringFatal);
        return;
      }

      const { error: genErr } = await supabase.rpc('generate_buy_list_from_profit', { p_run_list_id: runListId });
      if (genErr) {
        toast.error('Failed to regenerate Buy List');
      } else {
        toast.success('Buy List regenerated with latest preferences!');
      }

      // Bust the cache so the next load fetches fresh scored data
      invalidateRunListCache(runListId);
      await loadData();
    } catch (err: unknown) {
      log.error('Regeneration failed', err);
      toast.error('Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pageItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pageItems.map(v => v.id)));
  };

  const strongBuyCount = vehicles.filter(v => normalizeAiRecommendation(v.ai_recommendation) === 'Strong Buy').length;
  const buyCount = vehicles.filter(v => normalizeAiRecommendation(v.ai_recommendation) === 'Buy').length;
  const totalProfit = vehicles
    .filter(v => {
      const rec = normalizeAiRecommendation(v.ai_recommendation);
      return rec && ['Strong Buy', 'Buy', 'Possible Buy'].includes(rec);
    })
    .reduce((s, v) => s + Math.max(0, v.estimated_profit ?? 0), 0);

  const filtered = vehicles
    .filter(v => {
      // Non-repairable and Certificate of Destruction have no retail path — never visible to dealer
      const ts = (v.title_status ?? '').toLowerCase();
      if (ts.includes('non-repairable') || ts.includes('certificate of destruction')) return false;
      // Mileage hard cap — hide over-limit vehicles unless the user is actively searching for one
      if (!searchQuery && maxMileagePref > 0 && v.mileage != null && v.mileage > maxMileagePref) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!(v.make?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q) || v.vin?.toLowerCase().includes(q))) return false;
      }
      if (filterRec === 'recommended') {
        const rec = normalizeAiRecommendation(v.ai_recommendation);
        if (!rec || !['Strong Buy', 'Buy', 'Possible Buy'].includes(rec)) return false;
      } else if (filterRec !== 'all' && normalizeAiRecommendation(v.ai_recommendation) !== filterRec) {
        return false;
      }
      if (filterHasCR === 'yes' && !v.has_cr) return false;
      if (filterHasCR === 'no' && v.has_cr) return false;

      // Apply active preferences client-side (bypassed in demoMode)
      if (!demoMode && activePrefs) {
        const activeBrands = activePrefs.no_brand_preference ? [] : (activePrefs.preferred_brands ?? []);
        const excludedBrands = activePrefs.excluded_brands ?? [];
        const activeTypes = normalizeVehicleTypeSelectionForSave(activePrefs.vehicle_types ?? []);
        const minPrice = activePrefs.min_price ?? 0;
        const maxPrice = activePrefs.max_price ?? 0;
        const minYear = activePrefs.min_year ?? 0;
        const maxYear = activePrefs.max_year ?? 9999;
        const minMileage = activePrefs.min_mileage ?? 0;
        const maxMileage = activePrefs.max_mileage ?? 0;
        const minCr = activePrefs.min_cr_score ?? 0;
        const allowNoCr = activePrefs.allow_no_cr ?? true;
        const maxRecon = activePrefs.max_recon_cost ?? 0;
        const allowSalvage = activePrefs.allow_salvage ?? false;
        const allowFrameDamage = activePrefs.allow_frame_damage ?? false;
        const allowTmu = activePrefs.allow_tmu ?? true;

        const makeUpper = (v.make ?? '').toUpperCase();
        if (activeBrands.length > 0) {
          const brandUpper = activeBrands.map(b => b.toUpperCase());
          if (!brandUpper.includes(makeUpper)) return false;
        }
        if (excludedBrands.length > 0) {
          const excludedBrandUpper = excludedBrands.map(b => b.toUpperCase());
          if (excludedBrandUpper.includes(makeUpper)) return false;
        }

        const price = v.buy_now ?? v.mmr_value ?? v.price_estimate ?? v.current_bid ?? 0;
        if (minPrice > 0 && price > 0 && price < minPrice) return false;
        if (maxPrice > 0 && price > maxPrice) return false;

        if (minYear > 0 && v.year && v.year < minYear) return false;
        if (maxYear < 9999 && v.year && v.year > maxYear) return false;

        if (minMileage > 0 && v.mileage != null && v.mileage < minMileage) return false;
        if (maxMileage > 0 && (v.mileage || 0) > maxMileage) return false;

        if (minCr > 0 && v.cr_score != null && v.cr_score < minCr) return false;
        if (minCr > 0 && v.cr_score == null && !allowNoCr) return false;

        const hasListingPrice = (v.buy_now || 0) > 0 || (v.price_estimate || 0) > 0 || (v.current_bid || 0) > 0;
        if (activeTypes.length > 0 && v.vehicle_type && v.vehicle_type !== 'Other' && !activeTypes.includes(v.vehicle_type)) return false;

        // Risk checks
        const riskFlags: string[] = Array.isArray(v.risk_flags) ? v.risk_flags : [];
        if (!allowSalvage && ts.includes('salvage')) return false;
        if (!allowFrameDamage && riskFlags.includes('Frame damage')) return false;
        if (!allowTmu && (ts.includes('tmu') || riskFlags.includes('TMU'))) return false;

        if (maxRecon > 0 && hasListingPrice && (v.estimated_recon_cost || 0) > maxRecon) return false;
        if (hasListingPrice && (v.estimated_profit || 0) < 0) return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'profit': return (b.estimated_profit ?? 0) - (a.estimated_profit ?? 0);
        case 'lane': {
          const la = parseInt(a.lane?.replace(/\D/g, '') || '0');
          const lb = parseInt(b.lane?.replace(/\D/g, '') || '0');
          return la - lb || (a.run_order ?? 0) - (b.run_order ?? 0);
        }
        case 'run_order': return (a.run_order ?? 0) - (b.run_order ?? 0);
        case 'cr_score': return (b.cr_score ?? -1) - (a.cr_score ?? -1);
        case 'mileage': return (a.mileage ?? 0) - (b.mileage ?? 0);
        default: return 0;
      }
    });

  const { page, pageSize, totalPages, totalItems, pageItems, setPage, setPageSize } = usePagination(filtered, 50);

  const hasRealValue = (val: unknown) => {
    if (val == null) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed !== '' && trimmed !== '-' && trimmed.toLowerCase() !== 'n/a' && trimmed.toLowerCase() !== 'null';
    }
    return true;
  };

  const showCR   = vehicles.some(v => v.cr_score != null || hasRealValue(v.condition_notes));
  const showLane = vehicles.some(v => hasRealValue(v.lane));
  const showRunLot = vehicles.some(v => v.run_order != null || hasRealValue(v.lot_number));
  const runLotLabel = vehicles.some(v => v.run_order != null) && vehicles.some(v => hasRealValue(v.lot_number))
    ? 'Run # / Lot #'
    : vehicles.some(v => hasRealValue(v.lot_number)) ? 'Lot #' : 'Run #';

  // ─── Run List Picker (with demo mode trigger) ───
  if (!runListId && !demoMode) {
    if (pickerLoading) {
      return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
    }

    // If no run lists, offer demo mode
    if (runLists.length === 0) {

      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Buy Lists</h2>
            <p className="text-sm text-muted-foreground">Select a run list to view its AI-generated buy list.</p>
          </div>
          <Card>
            <CardContent className="py-16 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No run lists uploaded yet</p>
              <p className="text-xs text-muted-foreground mb-6">Want to see how LogicLot works? Try our interactive demo with 150 real-style vehicles.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button onClick={startDemoMode} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Try Interactive Demo
                </Button>
                <Button variant="outline" onClick={() => navigate('/app/dashboard')}>Upload a Run List</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Buy Lists</h2>
            <p className="text-sm text-muted-foreground">Select a run list to view its AI-generated buy list.</p>
          </div>
          <Button variant="outline" size="sm" onClick={startDemoMode} className="gap-2">
            <Sparkles className="h-4 w-4" /> Try Demo
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <TableHeader>
                  <TableRow className="border-t border-b-2 border-slate-300 bg-slate-200 hover:bg-slate-300">
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap">Auction Name</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap">Source</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap">File</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap">Date</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap">Status</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap">Created</TableHead>
                    <TableHead className="w-24 border-r border-slate-200 last:border-r-0 text-slate-800 font-bold whitespace-nowrap"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runLists.map(rl => (
                    <TableRow key={rl.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSearchParams({ run_list_id: rl.id })}>
                      <TableCell className="font-medium border-r border-slate-200">{rl.auction_name || '—'}</TableCell>
                      <TableCell className="border-r border-slate-200">{rl.auction_source || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground border-r border-slate-200">{rl.file_name}</TableCell>
                      <TableCell className="border-r border-slate-200">{rl.auction_date ? new Date(rl.auction_date).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="border-r border-slate-200">
                        <Badge
                          variant={rl.status === 'ready' ? 'default' : rl.status === 'failed' ? 'destructive' : 'secondary'}
                          className={cn(
                            'capitalize',
                            rl.status === 'uploaded' && 'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100',
                            rl.status === 'processing' && 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/10',
                            rl.status === 'ready' && 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                            rl.status === 'failed' && 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
                          )}
                        >
                          {rl.status === 'processing' && (
                            <div className="h-3 w-3 mr-1.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          )}
                          {rl.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground border-r border-slate-200">{new Date(rl.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-1">View <ChevronRight className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !demoMode) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div data-tour="buylist-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (demoMode) { setDemoMode(false); setVehicles([]); } else { setSearchParams({}); } }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">{runList?.auction_name || 'Buy List'}</h2>
            <p className="text-sm text-muted-foreground">
              {runList?.auction_source && `${runList.auction_source} • `}
              {runList?.auction_date && `${new Date(runList.auction_date).toLocaleDateString()} • `}
              {vehicles.length} recommended vehicles
            </p>
          </div>
        </div>
        <div data-tour="buylist-actions" className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 hidden md:inline-flex',
              hasDealerZip
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            {hasDealerZip ? `Market ZIP ${dealerZip}` : 'Market ZIP missing'}
          </Badge>
          <Button data-tour="buylist-prefs-btn" variant="outline" size="sm" onClick={() => setPrefsModalOpen(true)} className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Preferences
          </Button>
          <Button data-tour="buylist-regen-btn" variant="outline" size="sm" onClick={regenerateBuyList} disabled={regenerating} className="gap-1.5">
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </Button>
        </div>
      </div>

      {!demoMode && !hasDealerZip && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">Dealer ZIP is missing</p>
                <Badge className="bg-amber-600 text-white hover:bg-amber-600">High impact</Badge>
              </div>
              <p className="text-sm text-amber-800/90 max-w-3xl">
                LogicLot is pricing this run list without local comparable listings. Retail value, estimated profit, and max bid can shift materially until a dealer ZIP is set.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => navigate('/app/preferences')}>
                <MapPin className="h-3.5 w-3.5" /> Set Dealer ZIP
              </Button>
              <Button variant="outline" size="sm" onClick={regenerateBuyList} disabled={regenerating} className="gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate After Saving
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Summary */}
      {Object.keys(activeFilters).length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-xs font-semibold text-primary mr-1">Active Filters ({activeFilters.source}):</span>
          {Object.entries(activeFilters).filter(([k]) => k !== 'source').map(([k, v]) => (
            <Badge key={k} variant="secondary" className="text-xs gap-1">
              {k}: {v}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => setPrefsModalOpen(true)}>
            Edit
          </Button>
        </div>
      )}

      {/* Filter Transparency Breakdown */}
      {filterTransparency && (
        <div data-tour="buylist-filter-breakdown" className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1.5">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            Filter Breakdown
          </h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{filterTransparency.totalInRunList} total in run list</span>
            <span className={cn('font-medium', hasDealerZip ? 'text-emerald-600' : 'text-amber-700')}>
              {hasDealerZip ? `Local market comps centered on ZIP ${dealerZip}` : 'Using fallback market pricing until dealer ZIP is set'}
            </span>
            {activeFilters['Brand'] && (
              <span className="text-foreground font-medium">{filterTransparency.brandMatches} {activeFilters['Brand']} found</span>
            )}
            {filterTransparency.excludedByBrand > 0 && <span className="text-amber-600">{filterTransparency.excludedByBrand} excluded by brand</span>}
            {filterTransparency.excludedByPrice > 0 && <span className="text-amber-600">{filterTransparency.excludedByPrice} excluded by price</span>}
            {filterTransparency.excludedByYear > 0 && <span className="text-amber-600">{filterTransparency.excludedByYear} excluded by year</span>}
            {filterTransparency.excludedByMileage > 0 && <span className="text-amber-600">{filterTransparency.excludedByMileage} excluded by mileage</span>}
            {filterTransparency.excludedByCR > 0 && <span className="text-amber-600">{filterTransparency.excludedByCR} excluded by CR</span>}
            {filterTransparency.excludedByType > 0 && <span className="text-amber-600">{filterTransparency.excludedByType} excluded by vehicle type</span>}
            {filterTransparency.excludedByRisk > 0 && <span className="text-amber-600">{filterTransparency.excludedByRisk} excluded by risk</span>}
            {filterTransparency.excludedByRecon > 0 && <span className="text-amber-600">{filterTransparency.excludedByRecon} excluded by recon cost</span>}
            {filterTransparency.excludedByNegativeProfit > 0 && <span className="text-destructive">{filterTransparency.excludedByNegativeProfit} excluded by negative profit</span>}
            <span className="text-emerald-600 font-medium">{filterTransparency.eligible} eligible</span>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div data-tour="buylist-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{vehicles.length}</p>
          <p className="text-xs text-muted-foreground">Total Vehicles</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{strongBuyCount}</p>
          <p className="text-xs text-muted-foreground">Strong Buy</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{buyCount}</p>
          <p className="text-xs text-muted-foreground">Buy</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalProfit)}</p>
          <p className="text-xs text-muted-foreground">Est. Profit (Recommended)</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div data-tour="buylist-filters" className="flex flex-wrap items-center gap-3">
        <div data-tour="buylist-search" className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search make/model/VIN..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger data-tour="buylist-sort" className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="profit">Highest Profit</SelectItem>
            <SelectItem value="lane">Lane Order</SelectItem>
            <SelectItem value="run_order">Run Order</SelectItem>
            <SelectItem value="cr_score">CR Score</SelectItem>
            <SelectItem value="mileage">Lowest Mileage</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRec} onValueChange={setFilterRec}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="AI Rec" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vehicles</SelectItem>
            <SelectItem value="recommended">Recommended Only</SelectItem>
            <SelectItem value="Strong Buy">Strong Buy</SelectItem>
            <SelectItem value="Buy">Buy</SelectItem>
            <SelectItem value="Possible Buy">Possible Buy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterHasCR} onValueChange={setFilterHasCR}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="CR" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All CR</SelectItem>
            <SelectItem value="yes">Has CR</SelectItem>
            <SelectItem value="no">No CR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vehicle Table */}
      <Card data-tour="buylist-table" className="mb-24">
        <CardContent className="p-0">
          {vehicles.length === 0 ? (
            <div className="py-16 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No vehicles matched your buying preferences for this run list.</p>
              <p className="text-xs text-muted-foreground mb-4">
                {hasDealerZip
                  ? 'Try broadening your filters (brands, price range, vehicle types, etc.)'
                  : 'Set your dealer ZIP first so LogicLot can use local market comps, then regenerate before broadening filters.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {!hasDealerZip && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/app/preferences')} className="gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Set Dealer ZIP
                  </Button>
                )}
                <Button size="sm" onClick={() => setPrefsModalOpen(true)} className="gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Change Preferences
                </Button>
                <Button variant="outline" size="sm" onClick={regenerateBuyList} disabled={regenerating} className="gap-1.5">
                  {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Regenerate Buy List
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ borderCollapse: 'collapse' }}>
              <Table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <TableHeader>
                  <TableRow className="border-t border-b-2 border-slate-300 bg-slate-200 hover:bg-slate-300">
                    <TableHead className="w-12 border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">
                      <Checkbox checked={selectedIds.size === pageItems.length && pageItems.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap">Vehicle</TableHead>
                    {showLane && <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">Lane</TableHead>}
                    {showRunLot && <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">{runLotLabel}</TableHead>}
                    {showCR && <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">CR</TableHead>}
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">Mileage</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">Est. Recon</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">Est. Profit</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">Max Bid</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">AI Rec</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold whitespace-nowrap text-center">Retail Value</TableHead>
                    <TableHead className="border-r border-slate-200 text-slate-800 font-bold last:border-r-0 whitespace-nowrap text-center">Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((v, idx) => {
                    const isSelected = selectedIds.has(v.id);
                    const isFirst = idx === 0 && page === 1;
                    return (
                      <TableRow key={v.id} className={`cursor-pointer border-b border-border ${isSelected ? 'bg-primary/[0.05]' : ''}`} onClick={() => setSelectedVehicle(v)}>
                        <TableCell className="border-r border-slate-200" onClick={e => e.stopPropagation()} {...(isFirst ? { 'data-tour': 'buylist-checkbox' } : {})}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(v.id)} />
                        </TableCell>
                        <TableCell className="border-r border-slate-200" {...(isFirst ? { 'data-tour': 'buylist-vehicle-info' } : {})}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground text-sm">
                                {v.year} {v.make} {v.model}
                              </span>
                              {v.trim && (
                                <span className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 rounded font-medium max-w-[80px] truncate">
                                  {v.trim}
                                </span>
                              )}
                              {v.is_bank_lendable && (
                                <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-[10px] py-0 px-1.5 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Bank Lendable
                                </Badge>
                              )}
                            </div>
                            <span className={cn("text-xs block", v.vin ? "text-muted-foreground" : "text-amber-600 font-medium")}>
                              {v.vin || 'VIN not found'}
                            </span>
                          </div>
                        </TableCell>
                        {showLane && <TableCell className="text-center font-medium border-r border-slate-200" {...(isFirst ? { 'data-tour': 'buylist-lane' } : {})}>{v.lane || '—'}</TableCell>}
                        {showRunLot && (
                          <TableCell className="text-center border-r border-slate-200">
                            {v.run_order && v.lot_number
                              ? `${v.run_order} / ${v.lot_number}`
                              : (v.run_order ?? v.lot_number ?? '—')}
                          </TableCell>
                        )}
                        {showCR && (
                          <TableCell className="text-center border-r border-slate-200" {...(isFirst ? { 'data-tour': 'buylist-cr' } : {})}>
                            {v.cr_score != null ? (
                              <Badge variant={v.cr_score >= 3 ? 'default' : 'secondary'}>{v.cr_score.toFixed(1)}</Badge>
                            ) : v.condition_notes ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-sky-600 border-sky-300 text-xs max-w-[90px] truncate cursor-help">
                                      {v.condition_notes.split(';')[0].trim().slice(0, 20)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[220px] text-xs">{v.condition_notes}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">No CR</Badge>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-center tabular-nums border-r border-slate-200" {...(isFirst ? { 'data-tour': 'buylist-mileage' } : {})}>{v.mileage?.toLocaleString() ?? '—'}</TableCell>
                        <TableCell className="text-center border-r border-slate-200" onClick={e => e.stopPropagation()} {...(isFirst ? { 'data-tour': 'buylist-recon' } : {})}>
                          <button
                            onClick={() => setReconEditVehicle(v)}
                            className="text-sm tabular-nums font-medium text-foreground hover:text-primary underline decoration-dotted underline-offset-2 transition-colors inline-flex items-center gap-1"
                          >
                            <Wrench className="h-3 w-3 text-muted-foreground" />
                            {v.estimated_recon_cost != null ? fmt(v.estimated_recon_cost) : '—'}
                          </button>
                        </TableCell>
                        <TableCell className={`text-center tabular-nums font-medium border-r border-slate-200 ${v.estimated_profit != null && v.estimated_profit < 0 ? 'text-red-500' : 'text-emerald-600'}`} {...(isFirst ? { 'data-tour': 'buylist-profit' } : {})}>
                          {v.estimated_profit != null ? fmt(v.estimated_profit) : '—'}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold border-r border-slate-200" {...(isFirst ? { 'data-tour': 'buylist-maxbid' } : {})}>
                          {v.recommended_max_bid != null && v.recommended_max_bid > 0 ? (
                            <span className="text-foreground font-bold">{fmt(v.recommended_max_bid)}</span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center border-r border-slate-200" {...(isFirst ? { 'data-tour': 'buylist-airec' } : {})}>{recBadge(v.ai_recommendation)}</TableCell>
                        <TableCell className="text-center border-r border-slate-200" onClick={e => e.stopPropagation()} {...(isFirst ? { 'data-tour': 'buylist-retail' } : {})}>
                          {v.retail_data_source === 'none' ? (
                            <span className="text-xs text-muted-foreground italic">No market data found</span>
                          ) : getRetailDisplayValue(v) != null ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setRetailDetailVehicle(v)}
                                className="text-sm font-medium text-primary hover:text-primary/80 underline decoration-dotted underline-offset-2 transition-colors"
                              >
                                {fmt(getRetailDisplayValue(v)!)}
                              </button>
                              {v.retail_market_position && (v.retail_data_source === 'market_comps' || v.retail_data_source === 'marketcheck') && (
                                <Badge
                                  variant="outline"
                                  className={cn('text-[10px] px-1.5 py-0',
                                    v.retail_market_position === 'Above Market' && 'text-amber-600 border-amber-300',
                                    v.retail_market_position === 'Below Market' && 'text-emerald-600 border-emerald-300',
                                    v.retail_market_position === 'At Market' && 'text-sky-600 border-sky-300',
                                  )}
                                >
                                  {v.retail_market_position === 'Above Market' ? '↑' : v.retail_market_position === 'Below Market' ? '↓' : '≈'}
                                </Badge>
                              )}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center border-r border-slate-200 last:border-r-0" {...(isFirst ? { 'data-tour': 'buylist-flags' } : {})}>
                          <div className="flex flex-col items-center gap-0.5">
                            {((v.detected_flags?.length ?? 0) > 0 || (v.confirmed_flags?.length ?? 0) > 0) && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-850 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-[10px] py-0 px-1.5 flex items-center gap-1 w-fit"
                              >
                                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" /> Announcement ({(v.detected_flags?.length ?? 0) + (v.confirmed_flags?.length ?? 0)})
                              </Badge>
                            )}
                            {v.title_status && 
                             v.title_status.toLowerCase() !== 'clean' && 
                             v.title_status.toLowerCase() !== 'clear' && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] px-1 py-0 w-fit font-medium uppercase tracking-wide',
                                  v.title_status.toLowerCase().includes('salvage')
                                    ? 'text-red-600 border-red-200 bg-red-50 dark:bg-red-950/20'
                                    : 'text-muted-foreground border-border bg-slate-50 dark:bg-slate-900',
                                )}
                              >
                                {v.title_status}
                              </Badge>
                            )}
                            {v.buy_now != null && v.buy_now > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={cn(
                                      'text-xs font-medium flex items-center gap-0.5 cursor-help',
                                      v.recommended_max_bid != null && v.recommended_max_bid >= v.buy_now
                                        ? 'text-emerald-600'
                                        : 'text-sky-600'
                                    )}>
                                      <DollarSign className="h-3 w-3" /> BN: {fmt(v.buy_now)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs max-w-[200px]">
                                    {v.recommended_max_bid != null && v.recommended_max_bid >= v.buy_now
                                      ? `Max bid (${formatPositiveMoney(v.recommended_max_bid) ?? '—'}) ≥ Buy Now — consider buying now directly`
                                      : `Buy Now price. Max bid: ${formatPositiveMoney(v.recommended_max_bid) ?? '—'}`}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {v.damage_location && (
                              <span className="text-xs text-orange-600 flex items-center gap-0.5">
                                <ShieldAlert className="h-3 w-3" /> {v.damage_location}
                              </span>
                            )}
                            {v.drive_condition && v.drive_condition.toLowerCase().includes('no start') && (
                              <span className="text-xs text-red-500 flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" /> No Start
                              </span>
                            )}
                            {v.body_condition && v.body_condition.toLowerCase().includes('deployed') && (
                              <span className="text-xs text-red-500 flex items-center gap-0.5">
                                <ShieldAlert className="h-3 w-3" /> Airbags Deployed
                              </span>
                            )}
                            {v.cr_score == null && !v.condition_notes && !v.damage_location && (
                              <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                <AlertTriangle className="h-3.5 w-3.5" /> No CR
                              </span>
                            )}
                            {(v.risk_flags?.length ?? 0) > 0 && v.risk_flags!
                              .filter(f => {
                                const l = f.toLowerCase();
                                return l !== 'clean' && l !== 'clear' && l !== 'clean title';
                              })
                              .map((f, i) => (
                                <span key={i} className="text-xs text-red-500 flex items-center gap-0.5">
                                  <ShieldAlert className="h-3 w-3" /> {f}
                                </span>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* Vehicle Detail Panel */}
      <Sheet open={!!selectedVehicle} onOpenChange={open => { if (!open) setSelectedVehicle(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedVehicle && (
            <VehicleDetailPanel
              vehicle={selectedVehicle}
              demoMode={demoMode}
              insightLoading={insightLoading}
              updatingAnnouncements={updatingAnnouncements}
              onUpdateAnnouncements={handleUpdateAnnouncements}
              onGenerateInsight={async () => {
                const v = selectedVehicle;
                setInsightLoading(true);
                try {
                  if (demoMode) {
                    // Simulate a short delay for realism, then generate locally
                    await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
                    const insight = generateDemoInsight(v);
                    setSelectedVehicle(prev => prev ? { ...prev, ai_insight: insight } : prev);
                    setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, ai_insight: insight } : x));
                  } else {
                    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
                    if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is missing from .env file.");
                    
                    const prompt = `Analyze this auction vehicle for a dealership acquiring wholesale inventory. Write a 1-2 sentence overview, then 3-4 bullet points. Use the exact numbers provided.

Format your response exactly as:
[1-2 sentence overview of the opportunity and overall verdict]

• [Key financial metric — profit, margin, or max bid context]
• [Most significant risk or condition consideration]
• [Market context — velocity, demand, or comparable value if known]
• Recommended action: [specific bid instruction with dollar amount]

Vehicle: ${v.year} ${v.make} ${v.model} ${v.trim || ''}
Mileage: ${v.mileage?.toLocaleString() || 'Unknown'} miles
Estimated Retail Value: $${v.estimated_retail_value || 'Unknown'}
Estimated Profit: $${v.estimated_profit || 'Unknown'}
Recommended Max Bid: $${v.recommended_max_bid || 'Unknown'}
Profit Score: ${v.profit_score || 'Unknown'}/100
Risk Flags: ${(v.risk_flags || []).join(', ') || 'None'}
Scoring Reasons: ${(v.scoring_reasons || []).join(', ') || 'None'}`;

                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.3 }
                      })
                    });
                    
                    if (!res.ok) throw new Error(`Google API returned ${res.status}`);
                    const geminiData = await res.json();
                    const insight = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!insight) throw new Error("Could not parse insight from Gemini response.");

                    setSelectedVehicle(prev => prev ? { ...prev, ai_insight: insight } : prev);
                    setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, ai_insight: insight } : x));
                  }
                } catch (err: unknown) {
                  toast.error('Could not generate insight: ' + getErrorMessage(err));
                } finally {
                  setInsightLoading(false);
                }
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Retail Value Detail Modal */}
      <RetailValueModal vehicle={retailDetailVehicle} onClose={() => setRetailDetailVehicle(null)} />

      {/* Recon Edit Modal */}
      <ReconEditModal
        vehicle={reconEditVehicle}
        onClose={() => setReconEditVehicle(null)}
        onSaved={(updatedVehicle) => {
          setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
          setReconEditVehicle(null);
        }}
        targetProfit={targetProfit}
      />

      {/* Sticky action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-xl shadow-[0_-4px_20px_hsl(var(--primary)/0.1)]">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between px-6 py-4">
            <span className="text-sm font-semibold text-foreground">
              {selectedIds.size} vehicle{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <Button onClick={() => setBidMapDialogOpen(true)} className="gap-2 px-6">
              <MapPin className="h-4 w-4" /> Add to Lane Strategy
            </Button>
          </div>
        </div>
      )}

      {buyList && (
        <AddToBidMapDialog
          open={bidMapDialogOpen}
          onOpenChange={setBidMapDialogOpen}
          buyListId={buyList.id}
          selectedVehicleIds={Array.from(selectedIds)}
          onComplete={(mapId: string) => {
            setSelectedIds(new Set());
            navigate(`/app/lane-strategy?map_id=${mapId}`);
          }}
        />
      )}

      {organization?.id && (
        <BuyListPreferencesModal
          open={prefsModalOpen}
          onOpenChange={setPrefsModalOpen}
          organizationId={organization.id}
          buyListId={buyList?.id ?? null}
          onSaved={regenerateBuyList}
        />
      )}

      {/* Demo mode banner */}
      {demoMode && !isOnboarding && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground rounded-full px-6 py-2.5 shadow-lg flex items-center gap-3">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">Demo Mode</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary-foreground/80 hover:text-primary-foreground rounded-full"
            onClick={() => navigate('/app/dashboard')}
          >
            Upload Real Run List
          </Button>
        </div>
      )}
    </div>
  );
};

/* ─── Recon Edit Modal ─── */

const ReconEditModal = ({ vehicle: v, onClose, onSaved, targetProfit }: {
  vehicle: AuctionVehicle | null;
  onClose: () => void;
  onSaved: (v: AuctionVehicle) => void;
  targetProfit: number | null;
}) => {
  const [reconValue, setReconValue] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (v) setReconValue(v.recon_override ?? v.estimated_recon_cost ?? 0);
  }, [v]);

  if (!v) return null;

  const rawTotal = (v.recon_base ?? 0) + (v.recon_cr_adj ?? 0) + (v.recon_age_adj ?? 0)
    + (v.recon_mileage_adj ?? 0) + (v.recon_type_adj ?? 0) + (v.recon_brand_adj ?? 0)
    + (v.recon_damage_adj ?? 0) + (v.recon_risk_adj ?? 0);
  const originalRecon = Math.round(rawTotal);
  const sliderMax = Math.max(8000, Math.ceil((originalRecon + 2000) / 500) * 500);
  const sliderStep = 50;
  const activeRecon = Math.max(0, Math.min(sliderMax, reconValue || 0));

  const handleSave = async () => {
    const newRecon = Math.round(activeRecon);
    setSaving(true);

    const isOverride = newRecon !== originalRecon;
    const wholesale = getWholesaleBasis(v);
    const retail = v.estimated_retail_value ?? 0;
    const auctionFee = v.estimated_auction_fee ?? 500;
    const newProfit = Math.round(retail - wholesale - newRecon - auctionFee);
    const marginReserve = targetProfit && targetProfit > 0 ? targetProfit : retail * 0.15;
    const newMaxBid = Math.round(retail - marginReserve - newRecon - auctionFee);

    const { error } = await supabase
      .from('auction_vehicles')
      .update({
        recon_override: isOverride ? newRecon : null,
        estimated_recon_cost: newRecon,
        estimated_profit: newProfit,
        recommended_max_bid: newMaxBid,
        total_estimated_cost: wholesale + newRecon + auctionFee,
      })
      .eq('id', v.id);

    if (error) {
      toast.error('Failed to save recon adjustment');
    } else {
      // Recalculate scoring pipeline database logic so the AI recommendation gets updated!
      await supabase.rpc('finalize_run_list_scoring', { p_run_list_id: v.run_list_id });

      // Fetch the updated vehicle from the database to get the fresh ai_recommendation and risk flags!
      const { data: updatedVeh } = await supabase
        .from('auction_vehicles')
        .select('*')
        .eq('id', v.id)
        .single();

      toast.success('Recon updated — profit and max bid recalculated');
      onSaved(updatedVeh || {
        ...v,
        recon_override: isOverride ? newRecon : null,
        estimated_recon_cost: newRecon,
        estimated_profit: newProfit,
        recommended_max_bid: newMaxBid,
        total_estimated_cost: wholesale + newRecon + auctionFee,
      });
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true);
    const wholesale = getWholesaleBasis(v);
    const retail = v.estimated_retail_value ?? 0;
    const auctionFee = v.estimated_auction_fee ?? 500;
    const newProfit = Math.round(retail - wholesale - originalRecon - auctionFee);
    const marginReserve = targetProfit && targetProfit > 0 ? targetProfit : retail * 0.15;
    const newMaxBid = Math.round(retail - marginReserve - originalRecon - auctionFee);

    const { error } = await supabase
      .from('auction_vehicles')
      .update({
        recon_override: null,
        estimated_recon_cost: originalRecon,
        estimated_profit: newProfit,
        recommended_max_bid: newMaxBid,
        total_estimated_cost: wholesale + originalRecon + auctionFee,
      })
      .eq('id', v.id);

    if (error) {
      toast.error('Failed to reset recon');
    } else {
      // Recalculate scoring pipeline database logic so the AI recommendation gets updated!
      await supabase.rpc('finalize_run_list_scoring', { p_run_list_id: v.run_list_id });

      // Fetch the updated vehicle from the database
      const { data: updatedVeh } = await supabase
        .from('auction_vehicles')
        .select('*')
        .eq('id', v.id)
        .single();

      toast.success('Recon reset to system estimate');
      setReconValue(originalRecon);
      onSaved(updatedVeh || {
        ...v,
        recon_override: null,
        estimated_recon_cost: originalRecon,
        estimated_profit: newProfit,
        recommended_max_bid: newMaxBid,
        total_estimated_cost: wholesale + originalRecon + auctionFee,
      });
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!v} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[95%] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Estimated Recon Cost
          </DialogTitle>
          <DialogDescription>
            {v.year} {v.make} {v.model} {v.trim}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please verify actual recon cost and adjust appropriately. This is an estimate using external data and scoring logic.
            </p>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <h4 className="text-xs font-semibold text-foreground mb-2">Recon Estimate Breakdown</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Base Recon ({v.vehicle_type || 'Default'})</span><span className="font-medium">{fmt(v.recon_base ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CR Used</span><span className="font-medium">{v.cr_score != null ? v.cr_score.toFixed(1) : 'No CR in file'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CR / No-CR Adjustment</span><span className="font-medium">+{fmt(v.recon_cr_adj ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Age Adjustment</span><span className="font-medium">+{fmt(v.recon_age_adj ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mileage Adjustment</span><span className="font-medium">+{fmt(v.recon_mileage_adj ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vehicle Type</span><span className="font-medium">+{fmt(v.recon_type_adj ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Brand/Make</span><span className="font-medium">+{fmt(v.recon_brand_adj ?? 0)}</span></div>
              {(v.recon_damage_adj ?? 0) !== 0 && (
                <div className={`flex justify-between ${(v.recon_damage_adj ?? 0) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  <span>Damage ({v.damage_location ?? 'location'})</span>
                  <span className="font-medium">{(v.recon_damage_adj ?? 0) >= 0 ? '+' : ''}{fmt(v.recon_damage_adj ?? 0)}</span>
                </div>
              )}
              {(v.recon_risk_adj ?? 0) > 0 && (
                <div className="flex justify-between text-destructive"><span>Risk Flags</span><span className="font-medium">+{fmt(v.recon_risk_adj ?? 0)}</span></div>
              )}
              <div className="border-t pt-1 mt-1 flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{fmt(rawTotal)}</span></div>
              <div className="border-t pt-1 mt-1 flex justify-between font-semibold text-foreground text-sm">
                <span>System Estimate</span>
                <span>{fmt(originalRecon)}</span>
              </div>
              {v.cr_score == null && (
                <p className="pt-1 text-[11px] text-muted-foreground">No-CR fallback applied: +$150 light uncertainty adjustment.</p>
              )}
            </div>
          </div>

          {v.recon_override != null && (
            <div className="flex items-center gap-2 text-xs text-primary">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Dealer override active: {fmt(v.recon_override)}</span>
            </div>
          )}

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">Adjusted Recon Amount</span>
              <span className="text-lg font-semibold tabular-nums text-foreground">{fmt(activeRecon)}</span>
            </div>
            <Slider
              value={[activeRecon]}
              min={0}
              max={sliderMax}
              step={sliderStep}
              onValueChange={(value) => setReconValue(value[0] ?? 0)}
              aria-label="Adjust estimated recon amount"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{fmt(0)}</span>
              <span>{fmt(sliderMax)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Final adjusted recon</span>
              <span className="font-medium text-foreground">{fmt(activeRecon)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {v.recon_override != null && (
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reset to Estimate
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save & Recalculate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Retail Value Modal ─── */

const RetailValueModal = ({ vehicle: v, onClose }: { vehicle: AuctionVehicle | null; onClose: () => void }) => {
  if (!v) return null;

  const retailValue = v.estimated_retail_value ?? 0;
  const wholesale = getWholesaleBasis(v);
  const mmr = v.mmr_value;
  const profitMargin = v.estimated_profit != null && retailValue > 0
    ? ((v.estimated_profit / retailValue) * 100).toFixed(1)
    : null;
  const marketDaySupply = v.market_day_supply ?? null;
  const avgDaysToSell = v.avg_days_to_sell ?? null;
  const isMarketComps = v.retail_data_source === 'market_comps' || v.retail_data_source === 'marketcheck';
  const pricingConfidence = isMarketComps
    ? (v.market_comp_count && v.market_comp_count >= 5 ? 'High' : 'Medium')
    : v.mmr_value ? 'Medium' : 'Low';

  const confirmed = v.confirmed_flags ?? [];
  let titlePenaltyPct = 0;
  let titlePenaltyLabel = '';
  if (confirmed.includes('salvage')) {
    titlePenaltyPct = 30;
    titlePenaltyLabel = 'Salvage Title Penalty (-30%)';
  } else if (confirmed.includes('rebuilt')) {
    titlePenaltyPct = 25;
    titlePenaltyLabel = 'Rebuilt Title Penalty (-25%)';
  }

  const stackables: Array<{ label: string; pct: number }> = [];
  if (confirmed.includes('major_accident')) stackables.push({ label: 'Major Accident Penalty (-10%)', pct: 10 });
  if (confirmed.includes('lemon')) stackables.push({ label: 'Lemon / Buyback Penalty (-15%)', pct: 15 });
  if (confirmed.includes('tmu')) stackables.push({ label: 'True Miles Unknown Penalty (-25%)', pct: 25 });

  // Compute retail breakdown (use stored values for demo, compute for real data)
  const baseMarket = v.retail_base_market_value ?? wholesale;
  const crAdj = v.retail_cr_adjustment ?? (() => {
    const cr = v.cr_score;
    if (cr == null) return -Math.round(baseMarket * 0.02);
    if (cr >= 4.5) return Math.round(baseMarket * 0.06);
    if (cr >= 4.0) return Math.round(baseMarket * 0.03);
    if (cr >= 3.5) return 0;
    if (cr >= 3.0) return -Math.round(baseMarket * 0.03);
    return -Math.round(baseMarket * 0.06);
  })();
  const mileageAdj = v.retail_mileage_adjustment ?? (() => {
    const m = v.mileage ?? 60000;
    if (m < 30000) return Math.round(baseMarket * 0.08);
    if (m < 60000) return Math.round(baseMarket * 0.03);
    if (m < 90000) return 0;
    if (m < 120000) return -Math.round(baseMarket * 0.04);
    return -Math.round(baseMarket * 0.08);
  })();
  const dealerMargin = v.retail_dealer_margin ?? Math.round(baseMarket * 0.14);
  const computedRetail = baseMarket + crAdj + mileageAdj + dealerMargin;
  const maxCap = Math.round(baseMarket * 1.35);
  const cappedRetail = Math.max(Math.round(baseMarket * 0.65), Math.min(maxCap, computedRetail));
  const isCapped = computedRetail !== cappedRetail;

  // Market position
  const marketPosition = v.retail_market_position ?? (() => {
    const ratio = retailValue / (baseMarket || 1);
    if (ratio > 1.15) return 'Above Market';
    if (ratio < 0.90) return 'Below Market';
    return 'At Market';
  })();

  const marketBadgeColor = marketPosition === 'Above Market'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : marketPosition === 'Below Market'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-sky-100 text-sky-700 border-sky-200';

  const localMarketContext = v.mileage && v.mileage < 80000
    ? 'Lower mileage units like this typically retail faster and can support stronger front-end pricing.'
    : v.mileage && v.mileage > 120000
      ? 'Higher mileage can slow turn time, so retail strategy should stay disciplined and market-aware.'
      : 'This unit sits in a normal retail band, so local pricing and days-supply should guide the desk decision.';

  return (
    <Dialog open={!!v} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[95%] sm:max-w-md max-h-[90svh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Retail Value Breakdown
          </DialogTitle>
          <DialogDescription>
            {v.year} {v.make} {v.model} {v.trim}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 overflow-y-auto flex-1 pr-1">
          {v.retail_data_source === 'none' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-semibold text-amber-800 mb-1">No market data found</p>
              <p className="text-xs text-amber-700">No active local listings were found for this vehicle. Retail value and max bid cannot be calculated. This vehicle is excluded from the buy list.</p>
            </div>
          )}
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-5 text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Estimated Retail Value</p>
            <p className="text-3xl font-bold text-foreground">{v.retail_data_source === 'none' ? '—' : fmt(retailValue)}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {pricingConfidence} Confidence
              </Badge>
              {isMarketComps && (
                <Badge variant="outline" className={cn('text-xs', marketBadgeColor)}>
                  {marketPosition}
                </Badge>
              )}
            </div>
          </div>

          {/* Retail Formula Breakdown */}
          <div className="rounded-lg border p-3 space-y-1">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              How This Value Is Calculated
            </h4>
            {isMarketComps && v.market_comp_count != null && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 mb-2">
                Based on {v.market_comp_count} local comparable listing{v.market_comp_count !== 1 ? 's' : ''} within ~100 miles
              </p>
            )}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {isMarketComps ? 'Local Market Average' : 'Base Market Value'}
                </span>
                <span className="font-medium">{fmt(baseMarket)}</span>
              </div>
              {isMarketComps && v.market_avg_mileage != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-[11px]">Market avg mileage</span>
                  <span className="text-[11px] text-muted-foreground">{v.market_avg_mileage.toLocaleString()} mi</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">CR Adjustment {v.cr_score != null ? `(CR ${v.cr_score.toFixed(1)})` : '(No CR)'}</span>
                <span className={cn('font-medium', crAdj >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                  {crAdj >= 0 ? '+' : ''}{fmt(crAdj)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mileage Adjustment ({(v.mileage ?? 0).toLocaleString()} mi)</span>
                <span className={cn('font-medium', mileageAdj >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                  {mileageAdj >= 0 ? '+' : ''}{fmt(mileageAdj)}
                </span>
              </div>
              {!isMarketComps && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dealer Margin ({dealerMargin > 0 && baseMarket > 0 ? `${((dealerMargin / baseMarket) * 100).toFixed(0)}%` : '—'})</span>
                  <span className="font-medium text-emerald-600">+{fmt(dealerMargin)}</span>
                </div>
              )}
              {titlePenaltyPct > 0 && (
                <div className="flex justify-between text-destructive">
                  <span className="text-muted-foreground">{titlePenaltyLabel}</span>
                  <span className="font-semibold">-{fmt(Math.round(computedRetail * (titlePenaltyPct / 100)))}</span>
                </div>
              )}
              {stackables.map((s, idx) => (
                <div key={idx} className="flex justify-between text-destructive">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold">-{fmt(Math.round(computedRetail * (s.pct / 100)))}</span>
                </div>
              ))}
              <div className="border-t pt-1 mt-1 flex justify-between font-semibold text-foreground text-sm">
                <span>Final Retail Value</span>
                <span>{fmt(retailValue)}</span>
              </div>
              {isCapped && (
                <p className="text-[11px] text-amber-600 mt-1">⚠ Safety cap applied — value limited to reasonable market range.</p>
              )}
              {!isMarketComps && (
                <p className="text-[11px] text-muted-foreground mt-1">Estimated from auction MMR data. Set your dealer ZIP in Preferences for local market pricing.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 bg-card">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Market Day Supply</span>
              </div>
              <p className="text-lg font-semibold">
                {marketDaySupply != null ? `${Math.round(marketDaySupply)} days` : 'Not available'}
              </p>
              {avgDaysToSell != null && (
                <p className="text-xs text-muted-foreground mt-0.5">Avg {Math.round(avgDaysToSell)}d to sell</p>
              )}
            </div>
            <div className="rounded-lg border p-3 bg-card">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Avg Days to Sell</span>
              </div>
              <p className="text-lg font-semibold">
                {avgDaysToSell != null ? `${Math.round(avgDaysToSell)} days` : 'Not available'}
              </p>
            </div>
          </div>

          <div className={cn(
            "rounded-lg border p-4 space-y-2",
            v.is_bank_lendable
              ? "bg-emerald-50/50 border-emerald-200"
              : "bg-red-50/50 border-red-200"
          )}>
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle className={cn("h-4 w-4", v.is_bank_lendable ? "text-emerald-600" : "text-destructive")} />
              Financing Lendability
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {v.is_bank_lendable ? (
                <span className="text-emerald-800 font-medium">
                  This vehicle books well for financing. It meets typical bank lending guidelines (under 10 years old, under 150k miles, clean title status, and no frame/structural damage).
                </span>
              ) : (
                <span className="text-destructive font-medium">
                  This vehicle does not book well for financing. It fails one or more banking criteria: older than 10 years, mileage exceeds 150k miles, branded title (Salvage/Rebuilt), value under $4,000, or frame damage.
                </span>
              )}
            </p>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <MapPinned className="h-4 w-4 text-primary" /> Local Market Context
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {v.make} {v.model}{marketDaySupply != null ? ` has roughly ${Math.round(marketDaySupply)} estimated market supply days` : ''}{avgDaysToSell != null ? ` and averages ${Math.round(avgDaysToSell)} days to sell` : ''}. {localMarketContext}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>⚠ Important:</strong> Retail value is based on local market listings. Always verify vehicle history, accidents, title status, frame damage, and condition issues, as these can significantly impact actual retail value.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary" className="text-xs">{v.mileage?.toLocaleString() ?? '—'} mi</Badge>
            {v.cr_score != null && <Badge variant="secondary" className="text-xs">CR: {v.cr_score.toFixed(1)}</Badge>}
            <Badge variant="secondary" className="text-xs">Score: {v.profit_score ?? '—'}/100</Badge>
            {v.title_status && <Badge variant="secondary" className="text-xs">{v.title_status}</Badge>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Detail Panel ─── */

function generateDemoInsight(v: AuctionVehicle): string {
  const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const profit = v.estimated_profit ?? 0;
  const score = v.profit_score ?? 0;
  const rec = v.ai_recommendation ?? 'Pass';
  const verdict = rec === 'Strong Buy' ? 'strong opportunity' : rec === 'Buy' ? 'solid candidate' : rec === 'Possible Buy' ? 'borderline opportunity' : 'low-priority unit';
  const intro = profit > 0
    ? `This ${v.year} ${v.make} ${v.model} is a ${verdict} with a ${score}/100 profit score and ${money(profit)} estimated margin at current valuations.`
    : `This ${v.year} ${v.make} ${v.model} scores ${score}/100 but currently projects a loss of ${money(Math.abs(profit))} — proceed only if recon costs can be reduced.`;
  const bullets: string[] = [];
  if (v.recommended_max_bid) bullets.push(`Recommended max bid is ${money(v.recommended_max_bid)} — do not exceed to protect your margin.`);
  if (v.estimated_recon_cost) bullets.push(`Recon estimated at ${money(v.estimated_recon_cost)}${v.estimated_recon_cost > 3000 ? ' — above typical threshold, review line items' : ''}.`);
  if (v.risk_flags && v.risk_flags.length > 0) bullets.push(`Risk flags: ${v.risk_flags.join(', ')}.`);
  else bullets.push('No major risk flags identified on this unit.');
  const action = profit >= 4000 ? 'Bid aggressively up to max bid — margin justifies pursuit.'
    : profit >= 1500 ? 'Bid at or below max bid — margin is moderate.'
    : 'Pass unless you have a committed retail buyer.';
  bullets.push(`Recommended action: ${action}`);
  return `${intro}\n\n${bullets.map(b => `• ${b}`).join('\n')}`;
}

function InsightView({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const intro: string[] = [];
  const bullets: string[] = [];
  let seenBullet = false;
  for (const line of lines) {
    if (/^[•*-]\s+/.test(line)) {
      seenBullet = true;
      bullets.push(line.replace(/^[•*-]\s+/, ''));
    } else if (!seenBullet) {
      intro.push(line);
    }
  }
  return (
    <div className="space-y-3">
      {intro.length > 0 && (
        <p className="text-sm text-foreground leading-relaxed font-medium">{intro.join(' ')}</p>
      )}
      {bullets.length > 0 && (
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
              <span className="text-primary font-bold mt-0.5 shrink-0 text-base leading-none">•</span>
              <span className="leading-snug font-medium">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-start py-2 border-b border-border/50 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground text-right">{value}</span>
  </div>
);

const VehicleDetailPanel = ({
  vehicle: v,
  demoMode,
  insightLoading,
  onGenerateInsight,
  onUpdateAnnouncements,
  updatingAnnouncements,
}: {
  vehicle: AuctionVehicle;
  demoMode: boolean;
  insightLoading: boolean;
  onGenerateInsight: () => void;
  onUpdateAnnouncements: (v: AuctionVehicle, nextConfirmed: string[], nextDismissed: string[]) => Promise<void>;
  updatingAnnouncements: boolean;
}) => {
  const explanations = buildRecommendationExplanation(v);
  return (
    <>
      <SheetHeader className="pb-4">
        <SheetTitle className="text-lg flex flex-wrap items-center gap-2">
          <span>{v.year} {v.make} {v.model} {v.trim}</span>
          {v.is_bank_lendable && (
            <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-xs py-0 px-2 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Bank Lendable
            </Badge>
          )}
        </SheetTitle>
        <SheetDescription className={cn("text-xs", !v.vin && "text-amber-600 font-medium")}>
          {v.vin || 'VIN not found'}
        </SheetDescription>
        <div className="pt-2 flex items-center gap-2">
          {recBadge(v.ai_recommendation)}
          {v.vehicle_type && <Badge variant="outline" className="text-xs">{v.vehicle_type}</Badge>}
        </div>
      </SheetHeader>

      <div className="rounded-lg border bg-muted/30 p-4 mb-4">
        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
          <Sparkles className="h-4 w-4 text-primary" /> AI Summary
        </h4>
        {v.ai_insight ? (
          <InsightView text={v.ai_insight} />
        ) : (
          <div>
            {v.ai_summary && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{v.ai_summary}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              disabled={insightLoading}
              onClick={onGenerateInsight}
            >
              {insightLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {insightLoading ? 'Generating…' : 'Generate AI Insight'}
            </Button>
          </div>
        )}
      </div>

      {/* Announcements & Flags Selector */}
      <div className="rounded-lg border p-4 mb-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Announcements & Title Flags
        </h4>
        
        {v.announcement_raw_text && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded border border-border/60">
            <span className="font-semibold text-foreground block mb-0.5">Scanned text:</span>
            {v.announcement_raw_text}
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          {FLAG_DEFINITIONS.map((flagDef) => {
            const isDetected = v.detected_flags?.includes(flagDef.id);
            const isConfirmed = v.confirmed_flags?.includes(flagDef.id);
            const isDismissed = v.dismissed_flags?.includes(flagDef.id);
            const isPending = isDetected && !isConfirmed && !isDismissed;

            return (
              <div
                key={flagDef.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all gap-3",
                  isPending && "bg-amber-50/70 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40",
                  isConfirmed && "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/40",
                  isDismissed && "bg-muted/30 border-border/50 opacity-60",
                  !isPending && !isConfirmed && !isDismissed && "bg-background border-border/80"
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{flagDef.label}</span>
                    {isPending && (
                      <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[9px] py-0 px-1 hover:bg-amber-100">
                        Pending
                      </Badge>
                    )}
                    {isConfirmed && (
                      <Badge variant="destructive" className="text-[9px] py-0 px-1">
                        Confirmed
                      </Badge>
                    )}
                    {isDismissed && (
                      <Badge variant="secondary" className="text-[9px] py-0 px-1">
                        Dismissed
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">{flagDef.description}</p>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {isPending && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 flex items-center gap-1"
                        disabled={updatingAnnouncements}
                        onClick={() => {
                          const nextConfirmed = [...(v.confirmed_flags ?? []), flagDef.id];
                          const nextDismissed = (v.dismissed_flags ?? []).filter(x => x !== flagDef.id);
                          onUpdateAnnouncements(v, nextConfirmed, nextDismissed);
                        }}
                      >
                        {updatingAnnouncements ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2.5 flex items-center gap-1 border-red-200 hover:bg-red-50 text-red-600 dark:hover:bg-red-950/20"
                        disabled={updatingAnnouncements}
                        onClick={() => {
                          const nextConfirmed = (v.confirmed_flags ?? []).filter(x => x !== flagDef.id);
                          const nextDismissed = [...(v.dismissed_flags ?? []), flagDef.id];
                          onUpdateAnnouncements(v, nextConfirmed, nextDismissed);
                        }}
                      >
                        Dismiss
                      </Button>
                    </>
                  )}

                  {isConfirmed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2.5 text-muted-foreground border-border hover:bg-muted"
                      disabled={updatingAnnouncements}
                      onClick={() => {
                        const nextConfirmed = (v.confirmed_flags ?? []).filter(x => x !== flagDef.id);
                        const nextDismissed = (v.dismissed_flags ?? []).filter(x => x !== flagDef.id);
                        onUpdateAnnouncements(v, nextConfirmed, nextDismissed);
                      }}
                    >
                      Undo
                    </Button>
                  )}

                  {isDismissed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2.5"
                      disabled={updatingAnnouncements}
                      onClick={() => {
                        const nextConfirmed = (v.confirmed_flags ?? []).filter(x => x !== flagDef.id);
                        const nextDismissed = (v.dismissed_flags ?? []).filter(x => x !== flagDef.id);
                        onUpdateAnnouncements(v, nextConfirmed, nextDismissed);
                      }}
                    >
                      Undo Dismiss
                    </Button>
                  )}

                  {!isPending && !isConfirmed && !isDismissed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2.5 border-dashed"
                      disabled={updatingAnnouncements}
                      onClick={() => {
                        const nextConfirmed = [...(v.confirmed_flags ?? []), flagDef.id];
                        const nextDismissed = (v.dismissed_flags ?? []).filter(x => x !== flagDef.id);
                        onUpdateAnnouncements(v, nextConfirmed, nextDismissed);
                      }}
                    >
                      Confirm Flag
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {explanations.length > 0 && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 mb-4">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
            <Lightbulb className="h-4 w-4 text-primary" /> Why this recommendation
          </h4>
          <ul className="space-y-1">
            {explanations.map((reason, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(v.scoring_reasons?.length ?? 0) > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">Scoring Reasons</h4>
          <div className="flex flex-wrap gap-1.5">
            {v.scoring_reasons!.map((r, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal">{r}</Badge>
            ))}
          </div>
        </div>
      )}

      {v.risk_flags && v.risk_flags.filter(f => {
        const l = f.toLowerCase();
        return l !== 'clean' && l !== 'clear' && l !== 'clean title';
      }).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Risk Flags
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {v.risk_flags!
              .filter(f => {
                const l = f.toLowerCase();
                return l !== 'clean' && l !== 'clear' && l !== 'clean title';
              })
              .map((f, i) => (
                <Badge key={i} variant="destructive" className="text-xs font-normal">{f}</Badge>
              ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Wrench className="h-4 w-4 text-primary" /> Recon Estimate Breakdown
        </h4>
        <div className="rounded-lg border p-3 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Base ({v.vehicle_type || 'Default'})</span><span>{fmt(v.recon_base ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">CR Used</span><span>{v.cr_score != null ? v.cr_score.toFixed(1) : 'No CR in file'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">CR / No-CR Adjustment</span><span>+{fmt(v.recon_cr_adj ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Age</span><span>+{fmt(v.recon_age_adj ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Mileage</span><span>+{fmt(v.recon_mileage_adj ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>+{fmt(v.recon_type_adj ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Brand</span><span>+{fmt(v.recon_brand_adj ?? 0)}</span></div>
          {(v.recon_damage_adj ?? 0) !== 0 && (
            <div className={`flex justify-between ${(v.recon_damage_adj ?? 0) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              <span>Damage ({v.damage_location ?? 'location'})</span>
              <span>{(v.recon_damage_adj ?? 0) >= 0 ? '+' : ''}{fmt(v.recon_damage_adj ?? 0)}</span>
            </div>
          )}
          {(v.recon_risk_adj ?? 0) > 0 && <div className="flex justify-between text-destructive"><span>Risk</span><span>+{fmt(v.recon_risk_adj ?? 0)}</span></div>}
          {v.cr_score == null && <div className="flex justify-between text-muted-foreground"><span>No-CR fallback</span><span>+{fmt(v.recon_cr_adj ?? 0)}</span></div>}
          <div className="flex justify-between font-semibold text-foreground border-t pt-1 mt-1">
            <span>System Estimate</span>
            <span>{fmt(v.recon_override ?? v.estimated_recon_cost ?? 0)}</span>
          </div>
          {v.recon_override != null && (
            <div className="flex justify-between text-primary font-medium border-t pt-1 mt-1">
              <span>Final Adjusted Recon</span>
              <span>{fmt(v.recon_override)}</span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/60 mt-2 italic">Estimate only — verify actual recon before bidding.</p>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2">Profit Breakdown</h4>
        <div className="rounded-lg border p-3">
          <DetailRow label="Wholesale Ref (MMR / Bid)" value={
            v.mmr_value != null ? fmt(v.mmr_value) : v.buy_now != null ? fmt(v.buy_now) : v.price_estimate != null ? fmt(v.price_estimate) : v.current_bid != null ? fmt(v.current_bid) : '—'
          } />
          <DetailRow label="Est. Retail Value" value={v.estimated_retail_value != null ? fmt(v.estimated_retail_value) : '—'} />
          <DetailRow label="− Est. Recon Cost" value={
            <span className="flex flex-col items-end">
              <span>{v.estimated_recon_cost != null ? fmt(v.estimated_recon_cost) : '—'}</span>
              {v.recon_override != null && <span className="text-[10px] text-primary">dealer adjusted</span>}
            </span>
          } />
          <DetailRow label="− Auction Fee" value={v.estimated_auction_fee != null ? fmt(v.estimated_auction_fee) : '—'} />
          <div className="flex justify-between items-start py-2 border-t-2 border-border mt-1">
            <span className="text-sm font-semibold text-foreground">Est. Profit</span>
            <span className="flex flex-col items-end">
              <span className={cn('text-sm font-bold', (v.estimated_profit ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600')}>
                {v.estimated_profit != null ? fmt(v.estimated_profit) : '—'}
              </span>
              {getRetailDisplayValue(v) != null && v.estimated_profit != null && (
                <span className="text-[10px] text-muted-foreground">
                  {((v.estimated_profit / getRetailDisplayValue(v)!) * 100).toFixed(1)}% margin
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between items-start py-2 border-t border-border/50">
            <span className="text-sm text-muted-foreground">Max Bid (recommended)</span>
            <span className="text-sm font-semibold text-foreground">{formatPositiveMoney(v.recommended_max_bid) ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2">Pricing Sources</h4>
        <div className="rounded-lg border p-3">
          {v.mmr_value != null && <DetailRow label="MMR Value" value={fmt(v.mmr_value)} />}
          {v.price_estimate != null && <DetailRow label="ACV / Price Est." value={fmt(v.price_estimate)} />}
          {v.current_bid != null && <DetailRow label="Current Bid" value={fmt(v.current_bid)} />}
          {v.buy_now != null && <DetailRow label="Buy Now" value={fmt(v.buy_now)} />}
          {v.mmr_value == null && v.price_estimate == null && v.current_bid == null && v.buy_now == null && (
            <p className="text-xs text-muted-foreground py-1">No raw pricing data available for this vehicle.</p>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Vehicle Details</h4>
        <div className="rounded-lg border p-3">
          <DetailRow label="Lane" value={v.lane || '—'} />
          {v.lot_number && <DetailRow label="Lot #" value={v.lot_number} />}
          {v.run_order != null && <DetailRow label="Run Order" value={v.run_order} />}
          <DetailRow label="Mileage" value={v.mileage?.toLocaleString() ?? '—'} />
          <DetailRow label="CR Score" value={v.cr_score?.toFixed(1) ?? 'N/A'} />
          <DetailRow label="Vehicle Type" value={v.vehicle_type || 'Other'} />
          <DetailRow label="Title Status" value={v.title_status || '—'} />
          <DetailRow label="Seller Type" value={v.seller_type || '—'} />
          {(v.damage_location || v.damage_type || v.drive_condition || v.body_condition || v.key_status) && (
            <>
              {v.damage_location && <DetailRow label="Damage Location" value={v.damage_location} />}
              {v.damage_type && <DetailRow label="Damage Type" value={v.damage_type} />}
              {v.drive_condition && <DetailRow label="Drive Condition" value={v.drive_condition} />}
              {v.body_condition && <DetailRow label="Body / Airbags" value={v.body_condition} />}
              {v.key_status && <DetailRow label="Keys" value={v.key_status} />}
            </>
          )}
          {v.condition_notes && <DetailRow label="Condition Notes" value={v.condition_notes} />}
          <DetailRow label="Profit Score" value={v.profit_score != null ? `${v.profit_score}/100` : '—'} />
        </div>
      </div>
    </>
  );
};

export default BuyList;