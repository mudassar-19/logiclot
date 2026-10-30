import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

const AdminCampaigns = () => {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Construction className="h-4 w-4 text-primary" /> Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This section will contain auction intelligence tools for admin testing. Check back later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCampaigns;
