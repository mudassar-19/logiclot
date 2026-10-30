import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { Loader2, User, Building2, Mail, Shield, Calendar, LogOut, Pencil, ArrowLeft, Check, X } from 'lucide-react';
import logo from '@/assets/logo.png';

const log = logger('Account');

type UserRole = 'dealer_principal' | 'general_manager' | 'marketing_manager' | 'controller';

const roleLabels: Record<UserRole, string> = {
  dealer_principal: 'Owner / Dealer Principal',
  general_manager: 'General Manager',
  marketing_manager: 'Marketing Manager',
  controller: 'Controller (Read-only)',
};

const Account = () => {
  const navigate = useNavigate();
  const { user, profile, organization, userRole, loading: authLoading, signOut, refreshProfile } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editDealershipName, setEditDealershipName] = useState('');
  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?tab=login');
    }
  }, [user, authLoading, navigate]);

  // Initialize edit form with current values
  useEffect(() => {
    if (profile) {
      setEditFullName(profile.full_name || '');
    }
    if (organization) {
      setEditDealershipName(organization.name || '');
    }
  }, [profile, organization]);

  const handleLogout = async () => {
    await signOut();
    log.info('User logged out');
    toast.success('You have been signed out of your account.');
    navigate('/');
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    
    if (!editFullName.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setIsSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: editFullName.trim() })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Update organization name if user has one
      if (organization && editDealershipName.trim()) {
        const { error: orgError } = await supabase
          .from('organizations')
          .update({ name: editDealershipName.trim() })
          .eq('id', organization.id);

        if (orgError) throw orgError;
      }

      await refreshProfile();
      setIsEditing(false);
      
      log.info('Profile updated successfully');
      toast.success('Your profile has been successfully updated.');
    } catch (error: unknown) {
      log.error('Error updating profile', error);
      toast.error(getErrorMessage(error) || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset to original values
    setEditFullName(profile?.full_name || '');
    setEditDealershipName(organization?.name || '');
    setIsEditing(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'Unknown';

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logo} alt="LogicLot" className="h-8 w-8 rounded transition-transform group-hover:scale-105" />
            <span className="font-brand font-bold text-xl">LogicLot</span>
          </Link>
          <div className="flex items-center gap-4">
            {organization && (
              <Link to="/app/dashboard" className="nav-link text-sm">
                Dashboard
              </Link>
            )}
            <Link to="/" className="nav-link text-sm flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12 relative z-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">Manage your profile and account preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Card */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Profile Information</CardTitle>
                <CardDescription>Your personal and dealership details</CardDescription>
              </div>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Full Name */}
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Full Name</Label>
                  {isEditing ? (
                    <Input
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">{profile?.full_name || 'Not set'}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Email Address</Label>
                  <p className="font-medium">{user.email || 'Not set'}</p>
                  {isEditing && (
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                  )}
                </div>
              </div>

              {/* Dealership */}
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Dealership Name</Label>
                  {isEditing && organization ? (
                    <Input
                      value={editDealershipName}
                      onChange={(e) => setEditDealershipName(e.target.value)}
                      placeholder="Enter dealership name"
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">{organization?.name || 'Not assigned'}</p>
                  )}
                </div>
              </div>

              {/* Role (Read-only - can only be changed by dealer principal) */}
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Role</Label>
                  <p className="font-medium">{userRole ? roleLabels[userRole] : 'Not assigned'}</p>
                  {isEditing && (
                    <p className="text-xs text-muted-foreground mt-1">Role can only be changed by a Dealer Principal</p>
                  )}
                </div>
              </div>

              {/* Created Date */}
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Member Since</Label>
                  <p className="font-medium">{createdAt}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Status Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-xl">Subscription</CardTitle>
              <CardDescription>Your current plan and billing status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">
                    {organization?.onboarding_completed ? 'Active' : 'Setup in progress'}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  organization?.onboarding_completed 
                    ? 'bg-green-500/10 text-green-600' 
                    : 'bg-yellow-500/10 text-yellow-600'
                }`}>
                  {organization?.onboarding_completed ? 'Active' : 'Pending'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logout Button */}
          <Button 
            variant="outline" 
            className="w-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Account;
