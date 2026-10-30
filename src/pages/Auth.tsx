import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { z } from 'zod';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import MovingBackground from '@/components/MovingBackground';
import { cn } from '@/lib/utils';

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, organization, signIn, signInWithGoogle, resetPassword, signOut, loading: authLoading } = useAuth();
  const log = logger('Auth');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const tabParam = searchParams.get('tab');

  useEffect(() => {
    if (tabParam === 'signup') navigate('/get-started', { replace: true });
  }, [tabParam, navigate]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => { if (err.path[0]) errors[err.path[0].toString()] = err.message; });
      setLoginErrors(errors);
      return;
    }
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);
    if (error) {
      log.warn('Login failed', error.message);
      toast.error(error.message.includes('Invalid login credentials') ? 'Invalid email or password.' : error.message);
    } else {
      log.info('User logged in');
      toast.success('Welcome back! You have successfully logged in.');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (error) {
      log.error('Google sign-in failed', error.message);
      toast.error('Google sign-in failed: ' + error.message);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    const { error } = await resetPassword(forgotPasswordEmail);
    setIsLoading(false);
    if (error) {
      log.error('Password reset failed', error.message);
      toast.error('Reset failed: ' + error.message);
    } else {
      log.info('Password reset email sent');
      toast.success('Check your email for a password reset link.');
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex flex-col relative">
        <MovingBackground />
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <Card className="card-glass rounded-3xl">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-heading">Reset Password</CardTitle>
                <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input id="forgot-email" type="email" placeholder="you@dealership.com" value={forgotPasswordEmail} onChange={(e) => setForgotPasswordEmail(e.target.value)} disabled={isLoading} />
                  </div>
                  <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : 'Send Reset Link'}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button variant="link" onClick={() => setShowForgotPassword(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />Back to Sign In
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in user routing: existing user → dashboard, new user (no org) → onboarding
  if (user && !authLoading) {
    if (organization) {
      // Existing user with org → dashboard
      return (
        <div className="min-h-screen flex flex-col relative">
          <MovingBackground />
          <SiteHeader />
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <Card className="card-glass rounded-3xl">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-heading">Already Signed In</CardTitle>
                  <CardDescription>You're currently logged in as {user.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full rounded-full" onClick={() => navigate('/app/dashboard')}>
                    Continue to Dashboard
                  </Button>
                  <Button variant="outline" className="w-full rounded-full" onClick={async () => { await signOut(); toast.success('You have been signed out.'); }}>
                    Sign Out
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );
    } else {
      // New Google user without org → send to onboarding step 2 (skip account step)
      navigate('/get-started?step=2', { replace: true });
      return null;
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <MovingBackground />
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="mt-20 w-full max-w-md">
          <Card className="card-glass rounded-3xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-heading">Welcome Back</CardTitle>
              <CardDescription>Sign in to your account to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="you@dealership.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} disabled={isLoading} />
                  {loginErrors.email && <p className="text-sm text-destructive">{loginErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-primary hover:underline">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={showPassword ? "Password" : "••••••••"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
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
                  {loginErrors.password && <p className="text-sm text-destructive">{loginErrors.password}</p>}
                </div>
                <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
                  {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : 'Sign In'}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card/90 px-2 text-muted-foreground">Or continue with</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full rounded-full" onClick={handleGoogleSignIn} disabled={isLoading}>
                  <GoogleIcon /><span className="ml-2">Sign in with Google</span>
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Don't have an account?{' '}
                <Link to="/get-started" className="text-primary hover:underline font-medium">Sign up</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
