import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, ToggleLeft, Shield } from 'lucide-react';
import { useState } from 'react';

const AdminSettings = () => {
  const [demoData, setDemoData] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ToggleLeft className="h-4 w-4 text-primary" /> Feature Toggles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Demo Data Mode</p>
              <p className="text-xs text-muted-foreground">Populate new dealerships with sample data</p>
            </div>
            <Switch checked={demoData} onCheckedChange={setDemoData} />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border/40">
            <div>
              <p className="text-sm font-medium">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">Show maintenance page to non-admin users</p>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Environment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">Development</Badge>
            <Badge variant="secondary" className="text-xs">Staging</Badge>
            <Badge className="text-xs">Production</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Environment flags and admin access control will be expanded as the platform scales.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
