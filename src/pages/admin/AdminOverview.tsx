import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Building2, Users, HardDrive, BrainCircuit, Gauge } from 'lucide-react';

type AdminOverviewActivityOrg = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>;
type AdminOverviewRecentOrg = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'name' | 'city' | 'state' | 'created_at'>;

const log = logger('AdminOverview');

interface PlatformMetrics {
  totalDealerships: number;
  activeDealerships: number;
  totalRunLists: number;
  totalVehiclesAnalyzed: number;
}

const AdminOverview = () => {
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalDealerships: 0,
    activeDealerships: 0,
    totalRunLists: 0,
    totalVehiclesAnalyzed: 0,
  });
  const [recentOrgs, setRecentOrgs] = useState<AdminOverviewRecentOrg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [orgsRes, runListsRes, vehiclesRes, recentRes] = await Promise.all([
          supabase.from('organizations').select('id, created_at, updated_at'),
          supabase.from('auction_run_lists').select('id', { count: 'exact', head: true }),
          supabase.from('auction_vehicles').select('id', { count: 'exact', head: true }),
          supabase.from('organizations').select('id, name, city, state, created_at').order('created_at', { ascending: false }).limit(5),
        ]);

        const orgs: AdminOverviewActivityOrg[] = orgsRes.data ?? [];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const activeCount = orgs.filter(o => o.updated_at >= thirtyDaysAgo).length;

        setMetrics({
          totalDealerships: orgs.length,
          activeDealerships: activeCount,
          totalRunLists: runListsRes.count || 0,
          totalVehiclesAnalyzed: vehiclesRes.count || 0,
        });
        setRecentOrgs((recentRes.data ?? []) as AdminOverviewRecentOrg[]);
      } catch (err: unknown) {
        log.error('Failed to load admin metrics', err);
        toast.error('Failed to load platform metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const kpis = [
    { label: 'Total Dealerships', value: metrics.totalDealerships, icon: Building2 },
    { label: 'Active (30d)', value: metrics.activeDealerships, icon: Gauge },
    { label: 'Run Lists Uploaded', value: metrics.totalRunLists, icon: HardDrive },
    { label: 'Vehicles Analyzed', value: metrics.totalVehiclesAnalyzed, icon: BrainCircuit },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground tracking-wide flex items-center gap-1.5">
                    <kpi.icon className="h-3.5 w-3.5" /> {kpi.label}
                  </p>
                  <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Recently Created Dealerships
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dealerships yet.</p>
          ) : (
            <div className="space-y-3">
              {recentOrgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{[org.city, org.state].filter(Boolean).join(', ') || 'No location'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
