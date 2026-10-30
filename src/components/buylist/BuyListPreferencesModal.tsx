import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Save, X, Plus, SlidersHorizontal, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { POPULAR_BRANDS, BRAND_MODELS } from '@/lib/vehicleBrands';
import { CANONICAL_VEHICLE_TYPES, expandVehicleTypeSelection, normalizeVehicleTypeSelectionForSave } from '@/lib/vehicleTypes';

const log = logger('BuyListPrefsModal');

interface Prefs {
  vehicle_types: string[];
  min_cr_score: number;
  allow_no_cr: boolean;
  min_mileage: number;
  max_mileage: number;
  min_price: number;
  max_price: number;
  min_year: number;
  max_year: number;
  preferred_brands: string[];
  preferred_models: string[];
  excluded_brands: string[];
  allow_salvage: boolean;
  allow_frame_damage: boolean;
  allow_accident_history: boolean;
  allow_tmu: boolean;
  target_profit: number;
  max_recon_cost: number;
  allow_exotics: boolean;
  no_brand_preference: boolean;
  no_targeted_profit: boolean;
  focus_on: 'both' | 'mds' | 'days_to_sell';
}

const defaults: Prefs = {
  vehicle_types: [...CANONICAL_VEHICLE_TYPES],
  min_cr_score: 0,
  allow_no_cr: true,
  min_mileage: 0,
  max_mileage: 250000,
  min_price: 0,
  max_price: 100000,
  min_year: 2000,
  max_year: 2026,
  preferred_brands: [],
  preferred_models: [],
  excluded_brands: [],
  allow_salvage: false,
  allow_frame_damage: false,
  allow_accident_history: false,
  allow_tmu: true,
  target_profit: 1500,
  max_recon_cost: 3000,
  allow_exotics: false,
  no_brand_preference: true,
  no_targeted_profit: false,
  focus_on: 'both',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  buyListId: string | null;
  onSaved: () => void;
}

const BuyListPreferencesModal = ({ open, onOpenChange, organizationId, buyListId, onSaved }: Props) => {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>({ ...defaults });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandInput, setBrandInput] = useState('');
  const [excludedBrandInput, setExcludedBrandInput] = useState('');
  const [modelInput, setModelInput] = useState('');

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoading(true);

    const loadPrefs = async () => {
      // First try to load buy-list override if buyListId is set
      if (buyListId) {
        const { data: override } = await (supabase as any)
          .from('buy_list_override_preferences')
          .select('*')
          .eq('buy_list_id', buyListId)
          .maybeSingle();

        if (override) {
          const preferredBrands: string[] = Array.isArray(override.preferred_brands) ? override.preferred_brands : [];
          const targetProfit = override.target_profit ?? 0;
          setPrefs({
            vehicle_types: expandVehicleTypeSelection(override.vehicle_types),
            min_cr_score: override.min_cr_score ?? 0,
            allow_no_cr: override.allow_no_cr ?? true,
            min_mileage: override.min_mileage ?? 0,
            max_mileage: override.max_mileage ?? 250000,
            min_price: override.min_price ?? 0,
            max_price: override.max_price ?? 100000,
            min_year: override.min_year ?? 2000,
            max_year: override.max_year ?? 2026,
            preferred_brands: preferredBrands,
            preferred_models: Array.isArray(override.preferred_models) ? override.preferred_models : [],
            excluded_brands: Array.isArray(override.excluded_brands) ? override.excluded_brands : [],
            allow_salvage: override.allow_salvage ?? false,
            allow_frame_damage: override.allow_frame_damage ?? false,
            allow_accident_history: override.allow_accident_history ?? false,
            allow_tmu: override.allow_tmu ?? true,
            target_profit: targetProfit,
            max_recon_cost: override.max_recon_cost ?? 3000,
            allow_exotics: override.allow_exotics ?? false,
            no_brand_preference: override.no_brand_preference ?? (preferredBrands.length === 0),
            no_targeted_profit: override.no_targeted_profit ?? (targetProfit === 0),
            focus_on: override.focus_on ?? 'both',
          });
          setLoading(false);
          return;
        }
      }

      // Fall back to main dealer_preferences
      const { data } = await (supabase as any)
        .from('dealer_preferences')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (data) {
        const d = data as any;
        const preferredBrands: string[] = Array.isArray(d.preferred_brands) ? d.preferred_brands : [];
        const targetProfit = d.target_profit ?? 1500;
        setPrefs({
          vehicle_types: expandVehicleTypeSelection(d.vehicle_types),
          min_cr_score: d.min_cr_score ?? 0,
          allow_no_cr: d.allow_no_cr ?? false,
          min_mileage: d.min_mileage ?? 0,
          max_mileage: d.max_mileage ?? 250000,
          min_price: d.min_price ?? 0,
          max_price: d.max_price ?? 100000,
          min_year: d.min_year ?? 2000,
          max_year: d.max_year ?? 2026,
          preferred_brands: preferredBrands,
          preferred_models: Array.isArray(d.preferred_models) ? d.preferred_models : [],
          excluded_brands: Array.isArray(d.excluded_brands) ? d.excluded_brands : [],
          allow_salvage: d.allow_salvage ?? false,
          allow_frame_damage: d.allow_frame_damage ?? false,
          allow_accident_history: d.allow_accident_history ?? false,
          allow_tmu: d.allow_tmu ?? true,
          target_profit: targetProfit,
          max_recon_cost: d.max_recon_cost ?? 3000,
          allow_exotics: d.allow_exotics ?? false,
          no_brand_preference: preferredBrands.length === 0,
          no_targeted_profit: targetProfit === 0,
          focus_on: d.focus_on ?? 'both',
        });
      } else {
        setPrefs({ ...defaults });
      }
      setLoading(false);
    };

    loadPrefs();
  }, [open, organizationId, buyListId]);

  const toggleVehicleType = (type: string) => {
    setPrefs(p => ({
      ...p,
      vehicle_types: p.vehicle_types.includes(type)
        ? p.vehicle_types.filter(t => t !== type)
        : [...p.vehicle_types, type],
    }));
  };

  const addBrand = () => {
    const brand = brandInput.trim();
    if (!brand || prefs.preferred_brands.includes(brand)) return;
    setPrefs(p => ({ ...p, preferred_brands: [...p.preferred_brands, brand] }));
    setBrandInput('');
  };

  const removeBrand = (brand: string) => {
    setPrefs(p => ({
      ...p,
      preferred_brands: p.preferred_brands.filter(b => b !== brand),
      preferred_models: p.preferred_models.filter(m => !m.startsWith(brand + ' — ')),
    }));
  };

  const addExcludedBrand = () => {
    const brand = excludedBrandInput.trim();
    if (!brand || prefs.excluded_brands.includes(brand)) return;
    setPrefs(p => ({ ...p, excluded_brands: [...p.excluded_brands, brand] }));
    setExcludedBrandInput('');
  };

  const removeExcludedBrand = (brand: string) => {
    setPrefs(p => ({ ...p, excluded_brands: p.excluded_brands.filter(b => b !== brand) }));
  };

  const addModel = () => {
    const m = modelInput.trim();
    if (!m || prefs.preferred_models.includes(m)) return;
    setPrefs(p => ({ ...p, preferred_models: [...p.preferred_models, m] }));
    setModelInput('');
  };

  const removeModel = (model: string) => {
    setPrefs(p => ({ ...p, preferred_models: p.preferred_models.filter(m => m !== model) }));
  };

  const handleSave = async () => {
    if (!buyListId) {
      toast.error('No Buy List selected');
      return;
    }
    setSaving(true);
    const brandsToSave = prefs.no_brand_preference ? [] : prefs.preferred_brands;
    const modelsToSave = prefs.no_brand_preference ? [] : prefs.preferred_models;
    const profitToSave = prefs.no_targeted_profit ? 0 : prefs.target_profit;

    const payload: any = {
      buy_list_id: buyListId,
      organization_id: organizationId,
      vehicle_types: normalizeVehicleTypeSelectionForSave(prefs.vehicle_types),
      min_cr_score: prefs.min_cr_score,
      allow_no_cr: prefs.allow_no_cr,
      min_mileage: prefs.min_mileage,
      max_mileage: prefs.max_mileage,
      min_price: prefs.min_price,
      max_price: prefs.max_price,
      min_year: prefs.min_year,
      max_year: prefs.max_year,
      preferred_brands: brandsToSave,
      preferred_models: modelsToSave,
      excluded_brands: prefs.excluded_brands,
      allow_tmu: prefs.allow_tmu,
      allow_salvage: prefs.allow_salvage,
      allow_frame_damage: prefs.allow_frame_damage,
      allow_accident_history: prefs.allow_accident_history,
      target_profit: profitToSave,
      max_recon_cost: prefs.max_recon_cost,
      allow_exotics: prefs.allow_exotics,
      no_brand_preference: prefs.no_brand_preference,
      no_targeted_profit: prefs.no_targeted_profit,
      focus_on: prefs.focus_on,
      updated_at: new Date().toISOString(),
    };

    log.info('Saving override for buy_list_id:', buyListId, payload);
    const { error } = await (supabase as any)
      .from('buy_list_override_preferences')
      .upsert(payload, { onConflict: 'buy_list_id' });

    setSaving(false);
    if (error) {
      toast.error('Failed to save preferences');
      log.error('Save error', error);
    } else {
      toast.success('Preferences saved — regenerating Buy List...');
      onOpenChange(false);
      onSaved();
    }
  };

  const filteredBrands = POPULAR_BRANDS.filter(b =>
    b.toLowerCase().includes(brandInput.toLowerCase()) &&
    !prefs.preferred_brands.includes(b)
  ).slice(0, 6);

  const filteredExcludedBrands = POPULAR_BRANDS.filter(b =>
    b.toLowerCase().includes(excludedBrandInput.toLowerCase()) &&
    !prefs.excluded_brands.includes(b)
  ).slice(0, 6);

  const modelSuggestions = prefs.preferred_brands.flatMap(brand => {
    const models = (BRAND_MODELS as Record<string, string[]>)[brand] || [];
    return models.map(m => `${brand} — ${m}`);
  }).filter(m => !prefs.preferred_models.includes(m));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95%] sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Quick Preferences
          </DialogTitle>
          <DialogDescription>
            Adjust filters for this Buy List only. Your main Preferences page is not affected.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-6 pb-4 space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-700" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-amber-900">Market ZIP is not controlled here</p>
                    <p className="text-xs text-amber-800/90">
                      This modal changes buy-list filters only. Dealer ZIP lives in the main Preferences page and directly affects local retail comps, profit, and max bid accuracy.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                      onClick={() => {
                        onOpenChange(false);
                        navigate('/app/preferences');
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5" /> Open Main Preferences
                    </Button>
                  </div>
                </div>
              </div>

              {/* Brands */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Preferred Brands</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="no-brand" className="text-xs text-muted-foreground">No preference</Label>
                    <Switch id="no-brand" checked={prefs.no_brand_preference} onCheckedChange={v => setPrefs(p => ({ ...p, no_brand_preference: v }))} />
                  </div>
                </div>
                {!prefs.no_brand_preference && (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type brand name..."
                        value={brandInput}
                        onChange={e => setBrandInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addBrand()}
                        className="h-8 text-sm"
                      />
                      <Button size="sm" variant="outline" className="h-8 px-3" onClick={addBrand}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {brandInput && filteredBrands.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {filteredBrands.map(b => (
                          <Badge key={b} variant="outline" className="cursor-pointer text-xs hover:bg-primary/10"
                            onClick={() => { setPrefs(p => ({ ...p, preferred_brands: [...p.preferred_brands, b] })); setBrandInput(''); }}>
                            + {b}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {prefs.preferred_brands.map(b => (
                        <Badge key={b} className="gap-1 text-xs">
                          {b}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => removeBrand(b)} />
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Preferred Models — shown when brands are selected */}
              {!prefs.no_brand_preference && prefs.preferred_brands.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Preferred Models <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Toyota — Camry"
                      value={modelInput}
                      onChange={e => setModelInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addModel()}
                      className="h-8 text-sm"
                      list="quick-model-suggestions"
                    />
                    <Button size="sm" variant="outline" className="h-8 px-3" onClick={addModel}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <datalist id="quick-model-suggestions">
                    {modelSuggestions.slice(0, 30).map(m => <option key={m} value={m} />)}
                  </datalist>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.preferred_models.map(m => (
                      <Badge key={m} className="gap-1 text-xs">
                        {m}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeModel(m)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Excluded Brands */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Excluded Brands</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type brand to exclude..."
                    value={excludedBrandInput}
                    onChange={e => setExcludedBrandInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExcludedBrand()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-3" onClick={addExcludedBrand}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {excludedBrandInput && filteredExcludedBrands.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {filteredExcludedBrands.map(b => (
                      <Badge key={b} variant="outline" className="cursor-pointer text-xs hover:bg-destructive/10"
                        onClick={() => { setPrefs(p => ({ ...p, excluded_brands: [...p.excluded_brands, b] })); setExcludedBrandInput(''); }}>
                        − {b}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {prefs.excluded_brands.map(b => (
                    <Badge key={b} variant="destructive" className="gap-1 text-xs">
                      {b}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeExcludedBrand(b)} />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Vehicle Types */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Vehicle Types</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CANONICAL_VEHICLE_TYPES.map(t => (
                    <Badge
                      key={t}
                      variant={prefs.vehicle_types.includes(t) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleVehicleType(t)}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Price</Label>
                  <Input type="number" value={prefs.min_price || ''} onChange={e => setPrefs(p => ({ ...p, min_price: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Price</Label>
                  <Input type="number" value={prefs.max_price || ''} onChange={e => setPrefs(p => ({ ...p, max_price: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
                </div>
              </div>

              {/* Year Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Year</Label>
                  <Input type="number" value={prefs.min_year || ''} onChange={e => setPrefs(p => ({ ...p, min_year: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Year</Label>
                  <Input type="number" value={prefs.max_year || ''} onChange={e => setPrefs(p => ({ ...p, max_year: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
                </div>
              </div>

              {/* Mileage Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Mileage</Label>
                  <Input type="number" value={prefs.min_mileage || ''} onChange={e => setPrefs(p => ({ ...p, min_mileage: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Mileage</Label>
                  <Input type="number" value={prefs.max_mileage || ''} onChange={e => setPrefs(p => ({ ...p, max_mileage: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
                </div>
              </div>

              {/* CR Score */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Min CR Score</Label>
                  <Input type="number" step="0.1" value={prefs.min_cr_score || ''} onChange={e => setPrefs(p => ({ ...p, min_cr_score: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={prefs.allow_no_cr} onCheckedChange={v => setPrefs(p => ({ ...p, allow_no_cr: v }))} />
                  <Label className="text-xs">Allow No CR</Label>
                </div>
              </div>

              {/* Profit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Target Profit</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="no-profit" className="text-xs text-muted-foreground">No targeted profit</Label>
                    <Switch id="no-profit" checked={prefs.no_targeted_profit} onCheckedChange={v => setPrefs(p => ({ ...p, no_targeted_profit: v }))} />
                  </div>
                </div>
                {!prefs.no_targeted_profit && (
                  <Input type="number" value={prefs.target_profit || ''} onChange={e => setPrefs(p => ({ ...p, target_profit: Number(e.target.value) || 0 }))} className="h-8 text-sm" placeholder="$1,500" />
                )}
              </div>

              {/* Max Recon */}
              <div className="space-y-1">
                <Label className="text-xs">Max Recon Cost</Label>
                <Input type="number" value={prefs.max_recon_cost || ''} onChange={e => setPrefs(p => ({ ...p, max_recon_cost: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Risk Tolerance</Label>
                <div className="space-y-2">
                  {[
                    { key: 'allow_tmu' as const, label: 'Allow TMU units' },
                    { key: 'allow_salvage' as const, label: 'Allow salvage titles' },
                    { key: 'allow_frame_damage' as const, label: 'Allow frame damage' },
                    { key: 'allow_accident_history' as const, label: 'Allow accident history' },
                    { key: 'allow_exotics' as const, label: 'Allow exotics' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-xs">{label}</Label>
                      <Switch checked={prefs[key]} onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Market Focus */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Market Focus</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['both', 'mds', 'days_to_sell'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPrefs(p => ({ ...p, focus_on: option }))}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        prefs.focus_on === option
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {option === 'both' ? 'Both' : option === 'mds' ? 'Est. Market Supply' : 'Days to Sell'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save & Regenerate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuyListPreferencesModal;
