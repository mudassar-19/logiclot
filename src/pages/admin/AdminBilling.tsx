import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { CreditCard } from 'lucide-react';
import { useState } from 'react';

const AdminBilling = () => {
  const [billingDisabled, setBillingDisabled] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Billing Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Billing Disabled Mode</p>
              <p className="text-xs text-muted-foreground">Disable all billing enforcement for testing</p>
            </div>
            <Switch checked={billingDisabled} onCheckedChange={setBillingDisabled} />
          </div>
          <div className="border-t border-border/40 pt-4">
            <p className="text-sm text-muted-foreground">
              Subscription management, invoice viewing, and payment simulation will be available once billing integration is configured.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBilling;
