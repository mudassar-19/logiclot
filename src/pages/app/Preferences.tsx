import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Save, X, Plus, SlidersHorizontal, Car, Shield, DollarSign, Tag, Wrench, Gauge, MapPin, TrendingUp } from 'lucide-react';
import { POPULAR_BRANDS, BRAND_MODELS } from '@/lib/vehicleBrands';
import { CANONICAL_VEHICLE_TYPES, expandVehicleTypeSelection, normalizeVehicleTypeSelectionForSave } from '@/lib/vehicleTypes';
import SalesHistoryUpload from '@/components/preferences/SalesHistoryUpload';

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
  excluded_brands: string[];
  preferred_models: string[];
  allow_salvage: boolean;
  allow_frame_damage: boolean;
  allow_accident_history: boolean;
  allow_tmu: boolean;
  min_profit: number;
  target_profit: number;
  max_recon_cost: number;
  allow_exotics: boolean;
  no_brand_preference: boolean;
  no_targeted_profit: boolean;
  dealer_zip: string;
  focus_on: 'mds' | 'days_to_sell' | 'both';
}

const defaults: Prefs = {
  vehicle_types: [...CANONICAL_VEHICLE_TYPES],
  min_cr_score: 0,
  allow_no_cr: false,
  min_mileage: 0,
  max_mileage: 250000,
  min_price: 0,
  max_price: 100000,
  min_year: 2000,
  max_year: 2026,
  preferred_brands: [],
  excluded_brands: [],
  preferred_models: [],
  allow_salvage: false,
  allow_frame_damage: false,
  allow_accident_history: false,
  allow_tmu: true,
  min_profit: 1000,
  target_profit: 2000,
  max_recon_cost: 3000,
  allow_exotics: false,
  no_brand_preference: true,
  no_targeted_profit: false,
  dealer_zip: '',
  focus_on: 'both',
};

const ZIP_CODE_PATTERN = /^\d{5}(-\d{4})?$/;
type DealerPreferenceRow = Database['public']['Tables']['dealer_preferences']['Row'] & {
  dealer_zip?: string | null;
  focus_on?: 'mds' | 'days_to_sell' | 'both' | null;
};
type DealerPreferenceInsert = Database['public']['Tables']['dealer_preferences']['Insert'] & {
  dealer_zip?: string | null;
  focus_on?: 'mds' | 'days_to_sell' | 'both';
};

const log = logger('Preferences');

const Preferences = () => {
  const { organization } = useAuth();
  const { isOnboarding } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [brandInput, setBrandInput] = useState('');
  const [excludedBrandInput, setExcludedBrandInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({ ...defaults });
  const dealerZipValue = prefs.dealer_zip.trim();
  const hasDealerZip = dealerZipValue.length > 0;
  const hasValidDealerZip = !hasDealerZip || ZIP_CODE_PATTERN.test(dealerZipValue);

  useEffect(() => {
    if (!organization?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('dealer_preferences')
        .select('*')
        .eq('organization_id', organization.id)
        .maybeSingle();
      if (data) {
        const d = data as DealerPreferenceRow;
        const preferredBrands: string[] = Array.isArray(d.preferred_brands) ? d.preferred_brands : [];
        const targetProfit = d.target_profit ?? 1500;
        const loadedPrefs: Prefs = {
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
          excluded_brands: Array.isArray(d.excluded_brands) ? d.excluded_brands : [],
          preferred_models: Array.isArray(d.preferred_models) ? d.preferred_models : [],
          allow_salvage: d.allow_salvage ?? false,
          allow_frame_damage: d.allow_frame_damage ?? false,
          allow_accident_history: d.allow_accident_history ?? false,
          allow_tmu: d.allow_tmu ?? true,
          min_profit: d.min_profit ?? 1000,
          target_profit: targetProfit,
          max_recon_cost: d.max_recon_cost ?? 3000,
          allow_exotics: d.allow_exotics ?? false,
          no_brand_preference: preferredBrands.length === 0,
          no_targeted_profit: targetProfit === 0,
          dealer_zip: d.dealer_zip ?? '',
          focus_on: (d.focus_on as 'mds' | 'days_to_sell' | 'both') ?? 'both',
        };
        log.info('Loaded preferences from DB', { preferredBrands, targetProfit, no_brand_preference: loadedPrefs.no_brand_preference });
        setPrefs(loadedPrefs);
        setExists(true);
      }
      setLoading(false);
    };
    load();
  }, [organization?.id]);

  const toggleVehicleType = (type: string) => {
    setPrefs(p => ({
      ...p,
      vehicle_types: p.vehicle_types.includes(type)
        ? p.vehicle_types.filter(t => t !== type)
        : [...p.vehicle_types, type],
    }));
  };

  const addBrand = (list: 'preferred_brands' | 'excluded_brands', value: string, setter: (v: string) => void) => {
    const brand = value.trim();
    if (!brand || prefs[list].includes(brand)) return;
    setPrefs(p => ({ ...p, [list]: [...p[list], brand] }));
    setter('');
  };

  const removeBrand = (list: 'preferred_brands' | 'excluded_brands', brand: string) => {
    setPrefs(p => {
      const updated = { ...p, [list]: p[list].filter(b => b !== brand) };
      // If removing a preferred brand, also remove its models
      if (list === 'preferred_brands') {
        updated.preferred_models = updated.preferred_models.filter(m => {
          const [b] = m.split(' — ');
          return b !== brand;
        });
      }
      return updated;
    });
  };

  const addModel = (model: string) => {
    if (!model || prefs.preferred_models.includes(model)) return;
    setPrefs(p => ({ ...p, preferred_models: [...p.preferred_models, model] }));
    setModelInput('');
  };

  const removeModel = (model: string) => {
    setPrefs(p => ({ ...p, preferred_models: p.preferred_models.filter(m => m !== model) }));
  };

  // Available models based on selected preferred brands
  const availableModels = prefs.preferred_brands.flatMap(brand => {
    const models = BRAND_MODELS[brand] || [];
    return models.map(m => `${brand} — ${m}`);
  }).filter(m => !prefs.preferred_models.includes(m));

  const handleSave = async () => {
    if (!organization?.id) return;
    if (hasDealerZip && !hasValidDealerZip) {
      toast.error('Enter a valid ZIP code, for example 20724 or 20724-1234');
      return;
    }
    setSaving(true);
    const brandsToSave = prefs.no_brand_preference ? [] : prefs.preferred_brands;
    const modelsToSave = prefs.no_brand_preference ? [] : prefs.preferred_models;
    const profitToSave = prefs.no_targeted_profit ? 0 : prefs.target_profit;
    const payload: DealerPreferenceInsert = {
      organization_id: organization.id,
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
      excluded_brands: prefs.excluded_brands,
      preferred_models: modelsToSave,
      allow_tmu: prefs.allow_tmu,
      allow_salvage: prefs.allow_salvage,
      allow_frame_damage: prefs.allow_frame_damage,
      allow_accident_history: prefs.allow_accident_history,
      min_profit: prefs.min_profit,
      target_profit: profitToSave,
      max_recon_cost: prefs.max_recon_cost,
      allow_exotics: prefs.allow_exotics,
      dealer_zip: dealerZipValue || null,
      focus_on: prefs.focus_on,
    };
    log.info('Saving preferences', { preferred_brands: brandsToSave, target_profit: profitToSave, no_brand_preference: prefs.no_brand_preference });
    const { error } = await supabase
      .from('dealer_preferences')
      .upsert(payload, { onConflict: 'organization_id' });
    setSaving(false);
    if (error) {
      toast.error('Failed to save preferences');
      log.error('Save error', error);
    } else {
      log.info('Preferences saved successfully');
      if (dealerZipValue) {
        toast.success(`Preferences saved. Local market comps will use ZIP ${dealerZipValue}.`);
      } else {
        toast.success('Preferences saved. Add a dealer ZIP to unlock local market pricing.');
      }
      setExists(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // During onboarding, skip the empty state — show the form with defaults
  if (!exists && !isOnboarding) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <SlidersHorizontal className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No Preferences Set</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Set up your dealership buying strategy to help LogicLot filter and score vehicles.
        </p>
        <Button onClick={() => setExists(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Preferences
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl" data-tour="pref-overview">
      {/* Price Range */}
      <Card data-tour="pref-price">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Price Range
          </CardTitle>
          <CardDescription>Set your target purchase price range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Min Purchase Price ($)</Label>
              <Input type="number" value={prefs.min_price} onChange={e => setPrefs(p => ({ ...p, min_price: +e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Max Purchase Price ($)</Label>
              <Input type="number" value={prefs.max_price} onChange={e => setPrefs(p => ({ ...p, max_price: +e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Year Range */}
      <Card data-tour="pref-year">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" /> Year Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Min Year</Label>
              <Input type="number" value={prefs.min_year} onChange={e => setPrefs(p => ({ ...p, min_year: +e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Max Year</Label>
              <Input type="number" value={prefs.max_year} onChange={e => setPrefs(p => ({ ...p, max_year: +e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mileage Range + TMU */}
      <Card data-tour="pref-mileage">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> Mileage Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Min Mileage</Label>
              <Input type="number" value={prefs.min_mileage} onChange={e => setPrefs(p => ({ ...p, min_mileage: +e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Max Mileage</Label>
              <Input type="number" value={prefs.max_mileage} onChange={e => setPrefs(p => ({ ...p, max_mileage: +e.target.value }))} />
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Switch checked={prefs.allow_tmu} onCheckedChange={v => setPrefs(p => ({ ...p, allow_tmu: v }))} />
            <Label className="text-sm">Allow TMU (True Miles Unknown) units</Label>
          </div>
          {prefs.allow_tmu && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Vehicles with TMU status will be included in results but flagged for additional review.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" /> Vehicle Types
          </CardTitle>
          <CardDescription>Select the types of vehicles you're interested in buying</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CANONICAL_VEHICLE_TYPES.map(type => (
              <Badge
                key={type}
                variant={prefs.vehicle_types.includes(type) ? 'default' : 'outline'}
                className="cursor-pointer px-3.5 py-2 text-sm transition-all hover:shadow-sm"
                onClick={() => toggleVehicleType(type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Condition Preferences */}
      <Card data-tour="pref-condition">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" /> Condition Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm mb-2 block">
              Minimum CR Score: <span className="font-semibold text-primary">{prefs.min_cr_score.toFixed(1)}</span>
            </Label>
            <Slider
              value={[prefs.min_cr_score]}
              onValueChange={([v]) => setPrefs(p => ({ ...p, min_cr_score: v }))}
              min={0} max={5} step={0.1}
              className="max-w-md"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={prefs.allow_no_cr} onCheckedChange={v => setPrefs(p => ({ ...p, allow_no_cr: v }))} />
            <Label className="text-sm">Allow vehicles with no condition report</Label>
          </div>
          {prefs.allow_no_cr && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Vehicles without condition reports can still appear, but should be flagged for manual condition review.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Brand Preferences */}
      <Card data-tour="pref-brands">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Brand Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* No brand preference toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={prefs.no_brand_preference}
              onCheckedChange={v => setPrefs(p => ({
                ...p,
                no_brand_preference: v,
                ...(v ? { preferred_brands: [], preferred_models: [] } : {}),
              }))}
            />
            <Label className="text-sm">No preferred brands — show all makes</Label>
          </div>

          {!prefs.no_brand_preference && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Preferred Brands</Label>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add brand..."
                  value={brandInput}
                  onChange={e => setBrandInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBrand('preferred_brands', brandInput, setBrandInput)}
                  className="max-w-xs"
                  list="brand-suggestions"
                />
                <Button variant="outline" size="sm" onClick={() => addBrand('preferred_brands', brandInput, setBrandInput)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <datalist id="brand-suggestions">
                {POPULAR_BRANDS.map(b => <option key={b} value={b} />)}
              </datalist>
              <div className="flex flex-wrap gap-2">
                {prefs.preferred_brands.map(b => (
                  <Badge key={b} variant="secondary" className="gap-1 pr-1">
                    {b} <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeBrand('preferred_brands', b)} />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Preferred Models — only when brands are selected */}
          {!prefs.no_brand_preference && prefs.preferred_brands.length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-sm font-medium mb-2 block">Preferred Models <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Search model..."
                    value={modelInput}
                    onChange={e => setModelInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const match = availableModels.find(m => m.toLowerCase().includes(modelInput.toLowerCase()));
                        if (match) addModel(match);
                      }
                    }}
                    className="max-w-xs"
                    list="model-suggestions"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const match = availableModels.find(m => m.toLowerCase().includes(modelInput.toLowerCase()));
                      if (match) addModel(match);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <datalist id="model-suggestions">
                  {availableModels
                    .filter(m => !modelInput || m.toLowerCase().includes(modelInput.toLowerCase()))
                    .slice(0, 30)
                    .map(m => <option key={m} value={m} />)}
                </datalist>
                <div className="flex flex-wrap gap-2">
                  {prefs.preferred_models.map(m => (
                    <Badge key={m} variant="secondary" className="gap-1 pr-1">
                      {m} <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeModel(m)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div>
            <Label className="text-sm font-medium mb-2 block">Excluded Brands</Label>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add brand to exclude..."
                value={excludedBrandInput}
                onChange={e => setExcludedBrandInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBrand('excluded_brands', excludedBrandInput, setExcludedBrandInput)}
                className="max-w-xs"
                list="brand-suggestions"
              />
              <Button variant="outline" size="sm" onClick={() => addBrand('excluded_brands', excludedBrandInput, setExcludedBrandInput)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {prefs.excluded_brands.map(b => (
                <Badge key={b} variant="destructive" className="gap-1 pr-1">
                  {b} <X className="h-3 w-3 cursor-pointer" onClick={() => removeBrand('excluded_brands', b)} />
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Risk Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={prefs.allow_salvage} onCheckedChange={v => setPrefs(p => ({ ...p, allow_salvage: v }))} />
            <Label className="text-sm">Allow Salvage Title</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={prefs.allow_frame_damage} onCheckedChange={v => setPrefs(p => ({ ...p, allow_frame_damage: v }))} />
            <Label className="text-sm">Allow Frame Damage</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={prefs.allow_accident_history} onCheckedChange={v => setPrefs(p => ({ ...p, allow_accident_history: v }))} />
            <Label className="text-sm">Allow Accident History</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={prefs.allow_exotics} onCheckedChange={v => setPrefs(p => ({ ...p, allow_exotics: v }))} />
            <Label className="text-sm">Allow Exotics</Label>
          </div>
        </CardContent>
      </Card>

      {/* Profit Target & Recon */}
      <Card data-tour="pref-profit">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" /> Profit Target & Recon Tolerance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              checked={prefs.no_targeted_profit}
              onCheckedChange={v => setPrefs(p => ({ ...p, no_targeted_profit: v, ...(v ? { target_profit: 0 } : { target_profit: 2000 }) }))}
            />
            <Label className="text-sm">No targeted profit — skip profit filtering</Label>
          </div>
          {prefs.no_targeted_profit && (
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              LogicLot will not apply a minimum profit filter when scoring vehicles. All vehicles will be evaluated without a profit target.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!prefs.no_targeted_profit && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Target Profit ($)</Label>
                <Input type="number" value={prefs.target_profit} onChange={e => setPrefs(p => ({ ...p, target_profit: +e.target.value }))} />
                <p className="text-xs text-muted-foreground">Used by AI when calculating recommended max bid</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Maximum Estimated Recon Cost ($)</Label>
              <Input type="number" value={prefs.max_recon_cost} onChange={e => setPrefs(p => ({ ...p, max_recon_cost: +e.target.value }))} />
              <p className="text-xs text-muted-foreground">Vehicles above this recon estimate will be flagged</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Market Data Location
            <Badge className={hasDealerZip ? 'bg-emerald-600 text-white hover:bg-emerald-600' : 'bg-amber-600 text-white hover:bg-amber-600'}>
              {hasDealerZip ? 'Configured' : 'High impact'}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            This setting materially affects retail value, estimated profit, and max bid because LogicLot prices against listings around this ZIP.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className={hasDealerZip ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3' : 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'}>
            <div className="flex items-start gap-3">
              <MapPin className={hasDealerZip ? 'h-4 w-4 mt-0.5 text-emerald-700' : 'h-4 w-4 mt-0.5 text-amber-700'} />
              <div className="space-y-1">
                <p className={hasDealerZip ? 'text-sm font-semibold text-emerald-900' : 'text-sm font-semibold text-amber-900'}>
                  {hasDealerZip ? `Local market pricing is locked to ZIP ${dealerZipValue}` : 'Dealer ZIP missing: market pricing is in fallback mode'}
                </p>
                <p className={hasDealerZip ? 'text-xs text-emerald-800/90' : 'text-xs text-amber-800/90'}>
                  {hasDealerZip
                    ? 'LogicLot will search comparable listings within roughly 100 miles of this ZIP when calculating retail value.'
                    : 'Without a dealer ZIP, LogicLot falls back to non-local estimation. That can materially change profit scores and recommended max bids.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label className="text-xs text-muted-foreground">Dealer ZIP Code</Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="e.g. 22401"
              value={prefs.dealer_zip}
              onChange={e => setPrefs(p => ({ ...p, dealer_zip: e.target.value }))}
              className={!hasDealerZip ? 'border-amber-300 focus-visible:ring-amber-400' : !hasValidDealerZip ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">Use your rooftop or primary auction market ZIP. LogicLot searches comparable listings within roughly 100 miles.</p>
            {!hasDealerZip && (
              <p className="text-xs text-amber-700">Recommended before trusting profit, retail, or max-bid outputs.</p>
            )}
            {hasDealerZip && !hasValidDealerZip && (
              <p className="text-xs text-destructive">Enter a valid ZIP code like 20724 or 20724-1234.</p>
            )}
          </div>

          {/* Focus On */}
          <div className="space-y-3" data-tour="pref-focus-on">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">Focus On</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Controls how market velocity (days to sell &amp; estimated market supply) influences vehicle scoring and buy list ranking.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['both', 'mds', 'days_to_sell'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPrefs(p => ({ ...p, focus_on: option }))}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    prefs.focus_on === option
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {option === 'both' ? 'Both (default)' : option === 'mds' ? 'Est. Market Supply' : 'Days to Sell'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {prefs.focus_on === 'both' && 'Both MDS and Days to Sell are factored into scoring — balanced approach.'}
              {prefs.focus_on === 'mds' && 'Vehicles with low estimated market supply (high demand) rank higher.'}
              {prefs.focus_on === 'days_to_sell' && 'Fast-moving inventory (low avg days on market) ranks higher.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sales History Upload */}
      <SalesHistoryUpload />

      {/* Save */}
      <div data-tour="pref-save" className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2 px-6">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};

export default Preferences;
