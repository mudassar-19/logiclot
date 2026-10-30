import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { z } from 'zod';
import { Loader2, ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import MovingBackground from '@/components/MovingBackground';

const log = logger('Signup');

const accountSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match", path: ['confirmPassword'],
});

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const MultiStepSignup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signUp, signInWithGoogle, loading, refreshProfile } = useAuth();

  const stepParam = searchParams.get('step');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Step 1 fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2 fields
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');

  const isStep2 = stepParam === '2';

  useEffect(() => {
    if (loading) return;
    if (isStep2) {
      if (!user) {
        navigate('/auth?tab=login', { replace: true });
        setCheckingOnboarding(false);
        return;
      }
      const checkOnboarding = async () => {
        const { data } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        if (data && data.length > 0) {
          navigate('/app/dashboard', { replace: true });
        } else {
          setCheckingOnboarding(false);
        }
      };
      checkOnboarding();
    } else {
      if (user) {
        navigate('/get-started?step=2', { replace: true });
      } else {
        setCheckingOnboarding(false);
      }
    }
  }, [user, loading, isStep2, navigate]);

  const validateAccount = () => {
    const result = accountSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => { if (err.path[0]) newErrors[err.path[0].toString()] = err.message; });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSignup = async () => {
    if (!validateAccount()) return;
    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, '');
      if (error) throw error;
      log.info('Account created, verification email sent');
      toast.success('Account created! Please check your email to verify, then sign in.');
      navigate('/auth?tab=login');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message.includes('already registered')) {
        toast.error('An account with this email already exists. Please sign in.');
      } else {
        toast.error(message || 'Something went wrong.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (error) {
      log.error('Google sign-in failed', error.message);
      toast.error('Google sign-in failed: ' + error.message);
    }
  };

  const handleCreateOrg = async () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!orgName.trim()) newErrors.orgName = 'Dealership name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_org_and_make_owner', { _org_name: orgName.trim() });
      if (error) throw error;
      // Update profile with full name
      if (user) {
        await supabase
          .from('profiles')
          .update({ full_name: fullName.trim() })
          .eq('user_id', user.id);
      }
      await refreshProfile();
      log.info('Organization created, onboarding complete');
      toast.success('Your dealership has been created. Welcome to LogicLot!');
      navigate('/app/dashboard');
    } catch (error: unknown) {
      log.error('Organization creation failed', error);
      toast.error(getErrorMessage(error) || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingOnboarding || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentStep = isStep2 ? 2 : 1;

  return (
    <div className="min-h-screen relative">
      <MovingBackground />
      <SiteHeader />

      {/* Top padding to clear the fixed SiteHeader */}
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-12 relative z-10">
        {/* Progress */}
        <div className="mb-10">
          <Progress value={isStep2 ? 100 : 50} className="h-2" />
          <div className="flex justify-between mt-5">
            {[{ id: 1, title: 'Account' }, { id: 2, title: 'Setup Dealership' }].map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1.5">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  currentStep >= s.id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 border border-border text-muted-foreground'
                }`}>
                  {currentStep > s.id ? <Check className="h-5 w-5" /> : s.id}
                </div>
                <span className={`text-xs ${
                  currentStep >= s.id ? 'font-bold text-primary' : 'font-normal text-slate-200'
                }`}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!isStep2 ? (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <Card className="card-glass rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">Create Your Account</CardTitle>
                  <CardDescription>Sign up to get started with LogicLot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button type="button" variant="outline" className="w-full rounded-full h-12 text-base" onClick={handleGoogleSignUp} disabled={isLoading}>
                    <GoogleIcon /><span className="ml-2">Continue with Google</span>
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card/90 px-2 text-muted-foreground">Or sign up with email</span></div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@premierauto.com" />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={showPassword ? "Password" : "••••••••"}
                        className={cn("pr-10", !showPassword && "font-mono text-lg tracking-widest placeholder:text-muted-foreground placeholder:text-sm placeholder:tracking-normal")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                    <p className="text-xs text-muted-foreground">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={showConfirmPassword ? "Confirm Password" : "••••••••"}
                        className={cn("pr-10", !showConfirmPassword && "font-mono text-lg tracking-widest placeholder:text-muted-foreground placeholder:text-sm placeholder:tracking-normal")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>

                  <Button onClick={handleSignup} disabled={isLoading} className="w-full rounded-full h-12 text-base gap-2 mt-4">
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating Account...</> : <>Create Account <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-slate-300 mt-6">
                Already have an account?{' '}
                <Link to="/auth?tab=login" className="text-primary hover:underline font-medium">Sign in</Link>
              </p>
            </motion.div>
          ) : (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <Card className="card-glass rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">Set Up Your Dealership</CardTitle>
                  <CardDescription>Tell us about yourself and your dealership to get started</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                    />
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Dealership / Organization Name *</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Premier Auto Group"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                    />
                    {errors.orgName && <p className="text-sm text-destructive">{errors.orgName}</p>}
                  </div>

                  <Button onClick={handleCreateOrg} disabled={isLoading} className="w-full rounded-full h-12 text-base gap-2">
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : <>Create & Continue <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MultiStepSignup;
