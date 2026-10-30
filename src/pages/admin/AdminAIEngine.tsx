import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { BrainCircuit, RefreshCw } from 'lucide-react';

type AdminVehicleRow = Database['public']['Tables']['auction_vehicles']['Row'];
type AdminOrganizationRow = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'name'>;

interface RecentVehicle extends AdminVehicleRow {
  orgName: string;
  score: number | null;
  recommendation: string | null;
}

const log = logger('AdminAIEngine');

const AdminAIEngine = () => {
  const [recentVehicles, setRecentVehicles] = useState<RecentVehicle[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [vehiclesRes, orgsRes] = await Promise.all([
          supabase.from('auction_vehicles').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('organizations').select('id, name'),
        ]);
        if (vehiclesRes.error) throw vehiclesRes.error;
        if (orgsRes.error) throw orgsRes.error;
        const orgs: AdminOrganizationRow[] = orgsRes.data ?? [];
        const vehicles: AdminVehicleRow[] = vehiclesRes.data ?? [];
        const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
        const merged: RecentVehicle[] = vehicles.map((v) => ({
          ...v,
          orgName: orgMap[v.organization_id] || 'Unknown',
          score: v.profit_score,
          recommendation: v.ai_recommendation,
        }));
        setRecentVehicles(merged);
      } catch (err) {
        log.error('Failed to load AI engine data', err);
        toast.error('Failed to load AI engine data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" /> AI Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">AI Vehicle Analysis</p>
              <p className="text-xs text-muted-foreground">Toggle AI-powered auction vehicle scoring on/off platform-wide</p>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" /> Recently Analyzed Vehicles ({recentVehicles.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dealership</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead>Analyzed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentVehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.orgName}</TableCell>
                  <TableCell>{v.year} {v.make} {v.model}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{v.score ?? '—'}</Badge></TableCell>
                  <TableCell className="capitalize text-xs">{v.recommendation || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(v.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {recentVehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No vehicles analyzed yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAIEngine;
