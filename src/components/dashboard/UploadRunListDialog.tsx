import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Plus, Upload, FileSpreadsheet, X, SlidersHorizontal, ArrowLeft, ArrowRight, MapPin, Loader2 } from 'lucide-react';
import { POPULAR_BRANDS } from '@/lib/vehicleBrands';
import { CANONICAL_VEHICLE_TYPES, expandVehicleTypeSelection, normalizeVehicleTypeSelectionForSave } from '@/lib/vehicleTypes';

interface UploadRunListDialogProps {
  organizationId: string;
  userId: string;
  onUploadStart: (runListId: string) => void;
  defaultOpen?: boolean;
}

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

const defaultPrefs: Prefs = {
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

const RUN_LIST_ACCEPT = '.csv,.pdf,.xlsx,.xls';
const log = logger('UploadRunList');

const getRunListFileTypeLabel = (fileName: string) => {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'PDF';
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return 'Excel';
  return 'CSV';
};

const getRunListContentType = (file: File) => {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lowerName.endsWith('.xls')) return 'application/vnd.ms-excel';
  return 'text/csv';
};

const UploadRunListDialog = ({ organizationId, userId, onUploadStart, defaultOpen }: UploadRunListDialogProps) => {
  const [open, setOpen] = useState(defaultOpen || false);
  const [step, setStep] = useState<1 | 2>(1);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    file_name: '',
    auction_source: '',
    auction_name: '',
    auction_date: '',
  });

  const [prefs, setPrefs] = useState<Prefs>({ ...defaultPrefs });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [brandInput, setBrandInput] = useState('');
  const [excludedBrandInput, setExcludedBrandInput] = useState('');

  const resetForm = () => {
    setForm({ file_name: '', auction_source: '', auction_name: '', auction_date: '' });
    setSelectedFile(null);
    setStep(1);
    setBrandInput('');
    setExcludedBrandInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!open || !organizationId) return;
    setPrefsLoading(true);

    const loadPrefs = async () => {
      try {
        const { data, error } = await supabase
          .from('dealer_preferences')
          .select('*')
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (error) {
          log.error('Error loading preferences for upload safeguard', error);
        } else if (data) {
          const d = data as any;
          const preferredBrands = Array.isArray(d.preferred_brands) ? d.preferred_brands : [];
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
          });
        } else {
          setPrefs({ ...defaultPrefs });
        }
      } catch (err) {
        log.error('Unexpected error loading preferences', err);
      } finally {
        setPrefsLoading(false);
      }
    };

    loadPrefs();
  }, [open, organizationId]);

  const handleFileSelect = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.pdf') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please upload a CSV, Excel, or PDF file');
      return;
    }
    setSelectedFile(file);
    if (!form.file_name) {
      setForm(f => ({ ...f, file_name: file.name }));
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [form.file_name]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const handleSaveAndSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a CSV, Excel, or PDF file');
      return;
    }

    if (!form.file_name.trim()) {
      toast.error('File name is required');
      return;
    }

    const ZIP_CODE_PATTERN = /^\d{5}(-\d{4})?$/;
    const dealerZipValue = prefs.dealer_zip.trim();
    if (dealerZipValue && !ZIP_CODE_PATTERN.test(dealerZipValue)) {
      toast.error('Enter a valid ZIP code, for example 20724');
      return;
    }

    setUploading(true);

    try {
      // 1. Save preferences
      const brandsToSave = prefs.no_brand_preference ? [] : prefs.preferred_brands;
      const modelsToSave = prefs.no_brand_preference ? [] : prefs.preferred_models;
      const profitToSave = prefs.no_targeted_profit ? 0 : prefs.target_profit;

      const payload = {
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

      log.info('Saving safeguard preferences', payload);
      const { error: prefsError } = await supabase
        .from('dealer_preferences')
        .upsert(payload, { onConflict: 'organization_id' });

      if (prefsError) {
        log.error('Failed to save preferences safeguard', prefsError);
        toast.error('Failed to update buying preferences');
        setUploading(false);
        return;
      }

      // 2. Perform file upload
      const file = selectedFile;
      const storagePath = `${organizationId}/${Date.now()}-${file.name}`;

      log.info('Upload started for', file.name);
      const uploadResult = await supabase.storage
        .from('run-lists')
        .upload(storagePath, file, {
          contentType: getRunListContentType(file),
          upsert: false,
        });

      if (uploadResult.error || !uploadResult.data?.path) {
        log.error('Storage upload failed', uploadResult.error);
        toast.error(uploadResult.error?.message || 'Failed to upload file');
        setUploading(false);
        return;
      }
      log.info('File uploaded to storage', storagePath);

      const insertPayload = {
        organization_id: organizationId,
        created_by: userId,
        file_name: form.file_name.trim(),
        file_path: storagePath,
        auction_source: form.auction_source || null,
        auction_name: form.auction_name.trim() || null,
        auction_date: form.auction_date || null,
        status: 'uploaded',
      };

      const dbResult = await (supabase as any)
        .from('auction_run_lists')
        .insert(insertPayload)
        .select()
        .single();

      if (dbResult.error) {
        log.error('DB insert failed', dbResult.error);
        toast.error(dbResult.error.message || 'Failed to save run list record');
        setUploading(false);
        return;
      }

      const runListId = dbResult.data?.id;
      log.info('Run list row created, id:', runListId);

      setOpen(false);
      resetForm();
      setUploading(false);
      onUploadStart(runListId);
    } catch (err) {
      log.error('Unexpected error during upload safeguard flow', err);
      toast.error(err instanceof Error ? err.message : 'Something went wrong during upload');
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const filteredBrands = POPULAR_BRANDS.filter(b =>
    b.toLowerCase().includes(brandInput.toLowerCase()) &&
    !prefs.preferred_brands.includes(b)
  ).slice(0, 6);

  const filteredExcludedBrands = POPULAR_BRANDS.filter(b =>
    b.toLowerCase().includes(excludedBrandInput.toLowerCase()) &&
    !prefs.excluded_brands.includes(b)
  ).slice(0, 6);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Upload Run List
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[95%] sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border border-border/60 rounded-2xl shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border/40 bg-card/50">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              {step === 1 ? 'Upload Auction Run List' : 'Safeguard: Set Buying Preferences'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {step === 1
                ? 'Upload your auction run list file to start generating an AI-scored buy list.'
                : 'Confirm or tweak your buying filters and dealer margins so the run list is scored accurately.'}
            </p>
          </DialogHeader>

          {step === 1 ? (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Drop zone */}
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => !selectedFile && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : selectedFile
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={RUN_LIST_ACCEPT}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />

                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB · {getRunListFileTypeLabel(selectedFile.name)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 ml-2"
                      onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Upload className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      Drop your CSV, Excel, or PDF file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Supports CSV, XLSX, XLS, or PDF format run lists
                    </p>
                  </>
                )}
              </div>

              {/* File Name */}
              <div className="space-y-2">
                <Label>File Name *</Label>
                <Input
                  placeholder="Auto-filled from file or enter manually"
                  value={form.file_name}
                  onChange={e => setForm(f => ({ ...f, file_name: e.target.value }))}
                />
              </div>

              {/* Auction Source dropdown */}
              <div className="space-y-2">
                <Label>Auction Source <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select
                  value={form.auction_source}
                  onValueChange={v => setForm(f => ({ ...f, auction_source: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select auction source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="Manheim">Manheim</SelectItem>
                    <SelectItem value="ADESA">ADESA</SelectItem>
                    <SelectItem value="CarMax">CarMax</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auction Name */}
              <div className="space-y-2">
                <Label>Auction Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Tuesday Open Sale"
                  value={form.auction_name}
                  onChange={e => setForm(f => ({ ...f, auction_name: e.target.value }))}
                />
              </div>

              {/* Auction Date */}
              <div className="space-y-2">
                <Label>Auction Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  type="date"
                  value={form.auction_date}
                  onChange={e => setForm(f => ({ ...f, auction_date: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {prefsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading preferences safeguard data...</span>
                </div>
              ) : (
                <>
                  {/* Dealer location and targets */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dealer Targets &amp; ZIP</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs font-semibold">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Dealer ZIP Code *
                        </Label>
                        <Input
                          placeholder="e.g. 20724"
                          value={prefs.dealer_zip}
                          onChange={e => setPrefs(p => ({ ...p, dealer_zip: e.target.value }))}
                          maxLength={10}
                          className="h-9 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">Required for local retail comp pricing</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Target Profit ($) *</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="e.g. 2000"
                          value={prefs.no_targeted_profit ? '' : prefs.target_profit}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setPrefs(p => ({ ...p, target_profit: val, no_targeted_profit: val === 0 }));
                          }}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Min Profit Threshold ($)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={prefs.min_profit}
                          onChange={e => setPrefs(p => ({ ...p, min_profit: Number(e.target.value) }))}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Max Recon Cost ($)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={prefs.max_recon_cost}
                          onChange={e => setPrefs(p => ({ ...p, max_recon_cost: Number(e.target.value) }))}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Ranges */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vehicle Limits</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Model Year Range</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={prefs.min_year}
                            onChange={e => setPrefs(p => ({ ...p, min_year: Number(e.target.value) }))}
                            className="h-9 text-sm text-center"
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            value={prefs.max_year}
                            onChange={e => setPrefs(p => ({ ...p, max_year: Number(e.target.value) }))}
                            className="h-9 text-sm text-center"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Max Mileage (miles)</Label>
                        <Input
                          type="number"
                          value={prefs.max_mileage}
                          onChange={e => setPrefs(p => ({ ...p, max_mileage: Number(e.target.value) }))}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Min Condition Score (CR)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5.0"
                          value={prefs.min_cr_score}
                          onChange={e => setPrefs(p => ({ ...p, min_cr_score: Number(e.target.value) }))}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Max Wholesale Price ($)</Label>
                        <Input
                          type="number"
                          value={prefs.max_price}
                          onChange={e => setPrefs(p => ({ ...p, max_price: Number(e.target.value) }))}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Brands */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading">Brands Filters</h3>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Preferred Brands</Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="no-brand" className="text-[10px] text-muted-foreground">No preference</Label>
                          <Switch id="no-brand" checked={prefs.no_brand_preference} onCheckedChange={v => setPrefs(p => ({ ...p, no_brand_preference: v }))} className="scale-75" />
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
                              className="h-8 text-xs"
                            />
                            <Button size="sm" variant="outline" className="h-8 px-2" onClick={addBrand}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {brandInput && filteredBrands.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {filteredBrands.map(b => (
                                <Badge key={b} variant="outline" className="cursor-pointer text-[10px] hover:bg-primary/10"
                                  onClick={() => { setPrefs(p => ({ ...p, preferred_brands: [...p.preferred_brands, b] })); setBrandInput(''); }}>
                                  + {b}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {prefs.preferred_brands.map(b => (
                              <Badge key={b} className="gap-1 text-[10px] py-0.5">
                                {b}
                                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => removeBrand(b)} />
                              </Badge>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Excluded Brands</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type brand to exclude..."
                          value={excludedBrandInput}
                          onChange={e => setExcludedBrandInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addExcludedBrand()}
                          className="h-8 text-xs"
                        />
                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={addExcludedBrand}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {excludedBrandInput && filteredExcludedBrands.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {filteredExcludedBrands.map(b => (
                            <Badge key={b} variant="outline" className="cursor-pointer text-[10px] hover:bg-destructive/10 text-destructive border-destructive/20"
                              onClick={() => { setPrefs(p => ({ ...p, excluded_brands: [...p.excluded_brands, b] })); setExcludedBrandInput(''); }}>
                              − {b}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {prefs.excluded_brands.map(b => (
                          <Badge key={b} variant="destructive" className="gap-1 text-[10px] py-0.5">
                            {b}
                            <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => removeExcludedBrand(b)} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Exclusions */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exclusions &amp; Tolerances</h3>
                    <div className="grid grid-cols-2 gap-4 border border-border/50 rounded-xl p-4 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-salvage" className="text-xs font-medium cursor-pointer">Allow Salvage Title</Label>
                        <Switch
                          id="allow-salvage"
                          checked={prefs.allow_salvage}
                          onCheckedChange={v => setPrefs(p => ({ ...p, allow_salvage: v }))}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-frame" className="text-xs font-medium cursor-pointer">Allow Frame Damage</Label>
                        <Switch
                          id="allow-frame"
                          checked={prefs.allow_frame_damage}
                          onCheckedChange={v => setPrefs(p => ({ ...p, allow_frame_damage: v }))}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-accident" className="text-xs font-medium cursor-pointer">Allow Accident History</Label>
                        <Switch
                          id="allow-accident"
                          checked={prefs.allow_accident_history}
                          onCheckedChange={v => setPrefs(p => ({ ...p, allow_accident_history: v }))}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-tmu" className="text-xs font-medium cursor-pointer">Allow TMU (Odo discrepancy)</Label>
                        <Switch
                          id="allow-tmu"
                          checked={prefs.allow_tmu}
                          onCheckedChange={v => setPrefs(p => ({ ...p, allow_tmu: v }))}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-exotics" className="text-xs font-medium cursor-pointer">Allow Exotics</Label>
                        <Switch
                          id="allow-exotics"
                          checked={prefs.allow_exotics}
                          onCheckedChange={v => setPrefs(p => ({ ...p, allow_exotics: v }))}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-no-cr" className="text-xs font-medium cursor-pointer">Allow No Condition Report</Label>
                        <Switch
                          id="allow-no-cr"
                          checked={prefs.allow_no_cr}
                          onCheckedChange={v => setPrefs(p => ({ ...p, allow_no_cr: v }))}
                          className="scale-75"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="px-6 py-4 shrink-0 border-t border-border/40 bg-card/50 flex justify-end gap-3">
            {step === 1 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedFile || !form.file_name.trim()}
                className="gap-1.5"
              >
                Next: Set Preferences <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={uploading}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSaveAndSubmit}
                  disabled={uploading || prefsLoading}
                  className="gap-1.5"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" /> Creating...
                    </>
                  ) : (
                    <>
                      Confirm &amp; Create Buy List <Upload className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UploadRunListDialog;
