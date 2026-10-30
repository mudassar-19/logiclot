import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ShoppingCart, XCircle, DollarSign, Target, BarChart3 } from 'lucide-react';

const fmt = (n: number) => `$${n.toLocaleString()}`;

interface PerformanceData {
  total_selected_units: number | null;
  purchased_units: number | null;
  passed_units: number | null;
  total_purchase_spend: number | null;
  projected_profit_on_purchased_units: number | null;
  avg_profit_score_purchased: number | null;
}

interface Props {
  mapId: string;
}

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const AuctionPerformanceSummary = ({ mapId }: Props) => {
  const [data, setData] = useState<PerformanceData | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: rows } = await (supabase as any)
        .from('auction_performance_report')
        .select('*')
        .eq('bidding_map_id', mapId)
        .single();
      if (rows) setData(rows);
    };
    load();
  }, [mapId]);

  if (!data) return null;

  const hasPurchases = (data.purchased_units ?? 0) > 0 || (data.passed_units ?? 0) > 0;
  if (!hasPurchases) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Auction Performance</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Target} label="Selected" value={String(data.total_selected_units ?? 0)} color="bg-primary/10 text-primary" />
        <StatCard icon={ShoppingCart} label="Purchased" value={String(data.purchased_units ?? 0)} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard icon={XCircle} label="Passed" value={String(data.passed_units ?? 0)} color="bg-muted text-muted-foreground" />
        <StatCard icon={DollarSign} label="Total Spend" value={fmt(Number(data.total_purchase_spend ?? 0))} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard icon={TrendingUp} label="Proj. Profit" value={fmt(Number(data.projected_profit_on_purchased_units ?? 0))} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard icon={BarChart3} label="Avg Profit Score" value={String(Math.round(Number(data.avg_profit_score_purchased ?? 0)))} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>
    </div>
  );
};
