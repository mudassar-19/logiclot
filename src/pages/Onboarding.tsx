import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { 
  Loader2, 
  Building2, 
  MapPin, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  Home, 
  DollarSign, 
  Wrench, 
  Gauge, 
  TrendingUp, 
  Sparkles 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { motion, AnimatePresence } from 'framer-motion';

const log = logger('Onboarding');

type FocusOn = 'both' | 'mds' | 'days_to_sell';

interface OnboardingForm {
  dealershipName: string;
  dealerZip: string;
  focusOn: FocusOn;
  targetProfit: number;
  maxReconCost: number;
  maxMileage: number;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, organization, refreshProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  
  const [form, setForm] = useState<OnboardingForm>({
    dealershipName: '',
    dealerZip: '',
    focusOn: 'both',
    targetProfit: 1500,
    maxReconCost: 4000,
    maxMileage: 150000,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    // If user already completed onboarding, redirect to dashboard
    if (organization?.onboarding_completed) {
      navigate('/app/dashboard');
    }
  }, [organization, navigate]);

  const updateForm = <K extends keyof OnboardingForm>(field: K, value: OnboardingForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!form.dealershipName.trim()) {
        toast.error('Dealership name is required.');
        return;
      }
      if (!form.dealerZip.trim() || !/^\d{5}$/.test(form.dealerZip.trim())) {
        toast.error('A valid 5-digit Dealer ZIP Code is required.');
        return;
      }
    }
    setStep(s => Math.min(s + 1, 4));
  };

  const handlePrevStep = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: form.dealershipName,
          onboarding_completed: true,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Update profile with organization_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: newOrg.id })
        .eq('user_id', user?.id);

      if (profileError) throw profileError;

      // Create default role for user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user?.id,
          role: 'dealer_principal',
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      // Create default dealer preferences with the configured ZIP, Profit, Recon, Mileage, & Focus On settings
      await supabase.from('dealer_preferences').upsert({
        organization_id: newOrg.id,
        dealer_zip: form.dealerZip.trim(),
        focus_on: form.focusOn,
        preferred_brands: [],
        excluded_brands: [],
        vehicle_types: [],
        min_price: 0,
        max_price: 200000,
        min_year: 2010,
        max_year: new Date().getFullYear() + 1,
        min_mileage: 0,
        max_mileage: form.maxMileage,
        min_cr_score: 0.0,
        allow_no_cr: true,
        max_recon_cost: form.maxReconCost,
        allow_salvage: false,
        allow_frame_damage: false,
        allow_tmu: false,
        no_brand_preference: true,
        no_targeted_profit: false,
        target_profit: form.targetProfit,
      }, { onConflict: 'organization_id' });

      await refreshProfile();
      
      log.info('Onboarding completed for', form.dealershipName);
      toast.success('Your dealership profile is ready. Welcome to LogicLot!');
      
      // Navigate straight to dashboard with upload dialog activated
      navigate('/app/dashboard?upload=true');
    } catch (error: unknown) {
      log.error('Onboarding failed', error);
      toast.error(getErrorMessage(error) || 'Failed to complete setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = (step / 4) * 100;

  return (
    <div className="min-h-screen bg-[#FAFBFF] text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/95 backdrop-blur-xl z-50 flex-shrink-0">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="LogicLot" className="h-8 w-8 rounded" />
            <span className="font-bold text-lg tracking-tight">
              Logic<span className="text-[#5A5AFF]">Lot</span>
            </span>
          </div>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          
          {/* Progress Bar & Indicators */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span className="text-[#5A5AFF] font-bold">Step {step} of 4</span>
              <span>{Math.round(progressPercentage)}% Complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2 bg-slate-100" />
          </div>

          <Card className="border-slate-200 shadow-xl shadow-slate-100/50 bg-white overflow-hidden relative">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-[#5A5AFF]" />
                      Dealership Profile
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Configure your basic dealer profile parameters to begin.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealershipName" className="text-xs font-bold uppercase tracking-wider text-slate-500">Dealership Name *</Label>
                      <Input
                        id="dealershipName"
                        value={form.dealershipName}
                        onChange={(e) => updateForm('dealershipName', e.target.value)}
                        placeholder="e.g., Apex Motors"
                        className="border-slate-200 focus-visible:ring-[#5A5AFF] focus-visible:border-[#5A5AFF]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealerZip" className="text-xs font-bold uppercase tracking-wider text-slate-500">Dealer ZIP Code *</Label>
                      <Input
                        id="dealerZip"
                        value={form.dealerZip}
                        onChange={(e) => updateForm('dealerZip', e.target.value)}
                        placeholder="e.g., 22408"
                        maxLength={5}
                        className="border-slate-200 focus-visible:ring-[#5A5AFF] focus-visible:border-[#5A5AFF]"
                      />
                      <p className="text-[10px] text-slate-400 leading-normal">
                        ZIP is used to query the MarketCheck API for local market retail valuations within a 100-mile radius.
                      </p>
                    </div>
                    <div className="pt-4 flex justify-end">
                      <Button onClick={handleNextStep} className="bg-[#5A5AFF] hover:bg-[#4848E6] text-white">
                        Next Strategy Target <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-[#5A5AFF]" />
                      Profit & Recon Targets
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Determine your target wholesale profit buffer and maximum repair tolerance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Profit Per Vehicle</Label>
                        <span className="text-sm font-extrabold text-[#5A5AFF]">${form.targetProfit.toLocaleString()}</span>
                      </div>
                      <Slider
                        value={[form.targetProfit]}
                        min={500}
                        max={5000}
                        step={100}
                        onValueChange={(val) => updateForm('targetProfit', val[0])}
                      />
                      <p className="text-[10px] text-slate-400 leading-normal">
                        LogicLot uses this reserve buffer to calculate recommended maximum bids against estimated retail values.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Max Reconditioning Budget</Label>
                        <span className="text-sm font-extrabold text-[#5A5AFF]">${form.maxReconCost.toLocaleString()}</span>
                      </div>
                      <Slider
                        value={[form.maxReconCost]}
                        min={1000}
                        max={10000}
                        step={250}
                        onValueChange={(val) => updateForm('maxReconCost', val[0])}
                      />
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Vehicles exceeding this estimated reconditioning threshold will be marked with warning risk flags.
                      </p>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button variant="outline" onClick={handlePrevStep} className="border-slate-200">
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button onClick={handleNextStep} className="bg-[#5A5AFF] hover:bg-[#4848E6] text-white">
                        Next: Mileage Limits <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-[#5A5AFF]" />
                      Odometer Limits
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Configure your comfort limits for vehicle mileage.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Maximum Mileage Tolerance</Label>
                        <span className="text-sm font-extrabold text-[#5A5AFF]">{form.maxMileage.toLocaleString()} miles</span>
                      </div>
                      <Slider
                        value={[form.maxMileage]}
                        min={50000}
                        max={250000}
                        step={5000}
                        onValueChange={(val) => updateForm('maxMileage', val[0])}
                      />
                      <p className="text-[10px] text-slate-400 leading-normal">
                        LogicLot automatically filters out vehicles with mileage higher than this value from your recommended Buy List.
                      </p>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button variant="outline" onClick={handlePrevStep} className="border-slate-200">
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button onClick={handleNextStep} className="bg-[#5A5AFF] hover:bg-[#4848E6] text-white">
                        Next: Strategy Focus <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[#5A5AFF]" />
                      Market Scoring Focus
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Determine which market velocity metrics should influence vehicle ranking.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Scoring Priority</Label>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div 
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            form.focusOn === 'both' 
                              ? 'border-[#5A5AFF] bg-[#5A5AFF]/5 shadow-sm' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => updateForm('focusOn', 'both')}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">Balanced Approach (Recommended)</span>
                            {form.focusOn === 'both' && <CheckCircle2 className="h-4 w-4 text-[#5A5AFF]" />}
                          </div>
                          <p className="text-xs text-slate-500 leading-normal">
                            Equally weights Est. Market Supply (competitor volume) and average Days to Sell to find solid, reliable turn opportunities.
                          </p>
                        </div>

                        <div 
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            form.focusOn === 'days_to_sell' 
                              ? 'border-[#5A5AFF] bg-[#5A5AFF]/5 shadow-sm' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => updateForm('focusOn', 'days_to_sell')}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">Days to Sell (Turn Speed)</span>
                            {form.focusOn === 'days_to_sell' && <CheckCircle2 className="h-4 w-4 text-[#5A5AFF]" />}
                          </div>
                          <p className="text-xs text-slate-500 leading-normal">
                            Prioritizes fast-moving models that sell quickly in your local radius, maximizing your capital velocity.
                          </p>
                        </div>

                        <div 
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            form.focusOn === 'mds' 
                              ? 'border-[#5A5AFF] bg-[#5A5AFF]/5 shadow-sm' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => updateForm('focusOn', 'both')} // Fallback mds maps to 'both' or mds
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">Est. Market Supply (Low Competition)</span>
                            {form.focusOn === 'mds' && <CheckCircle2 className="h-4 w-4 text-[#5A5AFF]" />}
                          </div>
                          <p className="text-xs text-slate-500 leading-normal">
                            Focuses on high-demand models with low active supply in your 100-mile radius, protecting your retail margins.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button variant="outline" onClick={handlePrevStep} className="border-slate-200" disabled={isSubmitting}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="bg-[#5A5AFF] hover:bg-[#4848E6] text-white gap-1.5"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Setup...
                          </>
                        ) : (
                          <>
                            Complete Setup & Launch
                            <CheckCircle2 className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
