import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logger, getErrorMessage } from '@/lib/logger';
import { Loader2, Save, User, Building2, Bell, Bookmark, CreditCard, Calendar, FileText, HelpCircle, CheckCircle2 } from 'lucide-react';

const invoices = [
  { date: 'Feb 1, 2026', amount: '$199', status: 'Paid' },
  { date: 'Jan 1, 2026', amount: '$199', status: 'Paid' },
  { date: 'Dec 1, 2025', amount: '$199', status: 'Paid' },
];

type SupportTicketInsert = Database['public']['Tables']['support_tickets']['Insert'];
const log = logger('Settings');

const Settings = () => {
  const { user, profile, organization, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '', email: '', phone: '' });
  const [orgForm, setOrgForm] = useState({ name: '', city: '', state: '', phone: '', website: '' });
  const [billingOpen, setBillingOpen] = useState(false);

  // Help form state
  const [helpForm, setHelpForm] = useState({ subject: '', description: '', page: '' });
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpSubmitted, setHelpSubmitted] = useState(false);

  useEffect(() => {
    if (profile) setProfileForm({ fullName: profile.full_name || '', email: profile.email || '', phone: profile.phone || '' });
  }, [profile]);

  useEffect(() => {
    if (organization) setOrgForm({
      name: organization.name || '',
      city: organization.city || '',
      state: organization.state || '',
      phone: organization.phone || '',
      website: organization.website_url || '',
    });
  }, [organization]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: profileForm.fullName, phone: profileForm.phone }).eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      log.info('Profile saved');
      toast.success('Profile updated successfully');
    } catch (error: unknown) {
      log.error('Profile save failed', error);
      toast.error(getErrorMessage(error));
    } finally { setIsLoading(false); }
  };

  const handleSubmitIssue = async () => {
    if (!user || !helpForm.subject.trim() || !helpForm.description.trim()) {
      toast.error('Please fill in subject and description');
      return;
    }
    setHelpSubmitting(true);
    try {
      const ticket: SupportTicketInsert = {
        user_id: user.id,
        organization_id: organization?.id || null,
        subject: helpForm.subject.trim(),
        description: helpForm.description.trim(),
        page_or_feature: helpForm.page.trim() || null,
      };
      const { error } = await supabase.from('support_tickets').insert(ticket);
      if (error) throw error;
      log.info('Support ticket submitted');
      toast.success('Your issue has been submitted. We will review it soon.');
      setHelpSubmitted(true);
      setHelpForm({ subject: '', description: '', page: '' });
    } catch (error: unknown) {
      log.error('Support ticket submission failed', error);
      toast.error(getErrorMessage(error));
    } finally { setHelpSubmitting(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Dealership Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Dealership Profile
          </CardTitle>
          <CardDescription>Your dealership information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Dealership Name</Label>
              <Input value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Website</Label>
              <Input value={orgForm.website} onChange={e => setOrgForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">City</Label>
              <Input value={orgForm.city} onChange={e => setOrgForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">State</Label>
              <Input value={orgForm.state} onChange={e => setOrgForm(p => ({ ...p, state: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Account Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label className="text-xs">Full Name</Label><Input value={profileForm.fullName} onChange={e => setProfileForm(p => ({ ...p, fullName: e.target.value }))} /></div>
          <div className="space-y-2"><Label className="text-xs">Email</Label><Input value={profileForm.email} disabled className="bg-muted/50" /></div>
          <div className="space-y-2"><Label className="text-xs">Phone</Label><Input value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <Button onClick={handleSaveProfile} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive email alerts for new analysis results</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auction Reminders</Label>
              <p className="text-xs text-muted-foreground">Get reminded before upcoming auctions</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Weekly Summary</Label>
              <p className="text-xs text-muted-foreground">Receive a weekly digest of opportunities</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Saved Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" /> Saved Defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-generate Buy List</Label>
              <p className="text-xs text-muted-foreground">Automatically filter uploads against preferences</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Help / Submit an Issue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Help & Support
          </CardTitle>
          <CardDescription>Having an issue? Let us know and we'll get right on it.</CardDescription>
        </CardHeader>
        <CardContent>
          {helpSubmitted ? (
            <div className="py-8 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">Thank you for your submission</h4>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                We'll review your issue right away and get back to you as soon as possible.
              </p>
              <Button variant="outline" size="sm" className="mt-5" onClick={() => setHelpSubmitted(false)}>
                Submit Another Issue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Subject *</Label>
                <Input
                  placeholder="Brief summary of the issue"
                  value={helpForm.subject}
                  onChange={e => setHelpForm(p => ({ ...p, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description *</Label>
                <Textarea
                  placeholder="Describe the issue you're experiencing in detail..."
                  value={helpForm.description}
                  onChange={e => setHelpForm(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Page / Feature <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={helpForm.page} onValueChange={v => setHelpForm(p => ({ ...p, page: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the related page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="Dashboard">Dashboard</SelectItem>
                    <SelectItem value="Buy List">Buy List</SelectItem>
                    <SelectItem value="Lane Strategy">Lane Strategy</SelectItem>
                    <SelectItem value="Preferences">Preferences</SelectItem>
                    <SelectItem value="Upload / Parsing">Upload / Parsing</SelectItem>
                    <SelectItem value="Settings">Settings</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmitIssue} disabled={helpSubmitting || !helpForm.subject.trim() || !helpForm.description.trim()} className="gap-2">
                {helpSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />}
                Submit Issue
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing - moved to last, opens as dialog */}
      <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setBillingOpen(true)}>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Billing
          </CardTitle>
          <CardDescription>View your plan, payment method, and invoices</CardDescription>
        </CardHeader>
      </Card>

      {/* Billing Dialog */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="w-[95%] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Billing
            </DialogTitle>
            <DialogDescription>Manage your subscription and view invoices</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/15">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-foreground">Pro Plan</h4>
                <Badge className="bg-primary text-primary-foreground text-[10px]">Active</Badge>
              </div>
              <p className="text-xl font-bold text-foreground">$199<span className="text-sm font-normal text-muted-foreground">/month</span></p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Next billing: March 1, 2026</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs">Update Payment Method</Button>
              <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive">Cancel Plan</Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice History</p>
              {invoices.map((inv, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium">{inv.amount}</span>
                    <span className="text-xs text-muted-foreground">{inv.date}</span>
                  </div>
                  <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 text-[10px]">{inv.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
