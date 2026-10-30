import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface DashboardMetrics {
  vehiclesAnalyzed: number;
  hoursSaved: number;
  opportunitiesFound: number;
  potentialProfit: number;
  profitNotes: { label: string; amount: string }[];
  topOpportunities: { name: string; profit: number; pct: number; color: string }[];
  vehiclesTrend: { m: string; v: number }[];
  hoursTrend: { m: string; v: number }[];
  opportunitiesTrend: { m: string; v: number }[];
  hasData: boolean;
}

const OPPORTUNITY_COLORS = [
  'hsl(224, 100%, 52%)',
  'hsl(145, 63%, 42%)',
  'hsl(35, 91%, 50%)',
  'hsl(280, 68%, 55%)',
  'hsl(190, 80%, 42%)',
  'hsl(0, 72%, 51%)',
  'hsl(330, 65%, 50%)',
];

export function getOpportunityColor(_name: string, index: number): string {
  return OPPORTUNITY_COLORS[index % OPPORTUNITY_COLORS.length];
}

type TimeFilter = 'YTD' | 'MTD' | 'Quarterly';

function getDateRange(filter: TimeFilter): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;
  switch (filter) {
    case 'MTD':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'Quarterly': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
      break;
    }
    case 'YTD':
    default:
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { start, end };
}

export function useDashboardData(timeFilter: TimeFilter) {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const { start, end } = useMemo(() => getDateRange(timeFilter), [timeFilter]);

  const query = useQuery({
    queryKey: ['auction-data', orgId, timeFilter],
    enabled: !!orgId,
    queryFn: async () => {
      return await fetchAllRows((from, to) =>
        supabase
          .from('run_list_vehicles')
          .select('*, run_lists!inner(organization_id, created_at)')
          .eq('run_lists.organization_id', orgId!)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: true })
          .range(from, to)
      );
    },
  });

  const metrics: DashboardMetrics = useMemo(() => {
    const entries = query.data || [];
    if (entries.length === 0) {
      return {
        vehiclesAnalyzed: 0,
        hoursSaved: 0,
        opportunitiesFound: 0,
        potentialProfit: 0,
        profitNotes: [],
        topOpportunities: [],
        vehiclesTrend: [],
        hoursTrend: [],
        opportunitiesTrend: [],
        hasData: false,
      };
    }

    const vehiclesAnalyzed = entries.length;
    const hoursSaved = Math.round(vehiclesAnalyzed * 0.012 * 10) / 10; // ~0.7 min per vehicle
    const buyListItems = entries.filter((e: any) => e.in_buy_list);
    const opportunitiesFound = buyListItems.length;
    const potentialProfit = buyListItems.reduce((s: number, e: any) => s + (e.estimated_profit || 0), 0);

    // Top opportunities by profit
    const topOpportunities = buyListItems
      .sort((a: any, b: any) => (b.estimated_profit || 0) - (a.estimated_profit || 0))
      .slice(0, 5)
      .map((v: any, i: number) => ({
        name: `${v.year} ${v.make} ${v.model}`,
        profit: v.estimated_profit || 0,
        pct: potentialProfit > 0 ? Math.round(((v.estimated_profit || 0) / potentialProfit) * 100) : 0,
        color: OPPORTUNITY_COLORS[i % OPPORTUNITY_COLORS.length],
      }));

    const profitNotes = topOpportunities.slice(0, 2).map((v: any) => ({
      label: v.name,
      amount: `est profit $${v.profit.toLocaleString()}`,
    }));

    // Monthly trends
    const byMonth: Record<string, { vehicles: number; buyList: number }> = {};
    entries.forEach((e: any) => {
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { vehicles: 0, buyList: 0 };
      byMonth[key].vehicles++;
      if (e.in_buy_list) byMonth[key].buyList++;
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sortedMonths = Object.keys(byMonth).sort();
    const vehiclesTrend = sortedMonths.map(k => ({ m: monthNames[parseInt(k.split('-')[1]) - 1], v: byMonth[k].vehicles }));
    const hoursTrend = sortedMonths.map(k => ({ m: monthNames[parseInt(k.split('-')[1]) - 1], v: Math.round(byMonth[k].vehicles * 0.012 * 10) / 10 }));
    const opportunitiesTrend = sortedMonths.map(k => ({ m: monthNames[parseInt(k.split('-')[1]) - 1], v: byMonth[k].buyList }));

    return {
      vehiclesAnalyzed,
      hoursSaved,
      opportunitiesFound,
      potentialProfit,
      profitNotes,
      topOpportunities,
      vehiclesTrend,
      hoursTrend,
      opportunitiesTrend,
      hasData: true,
    };
  }, [query.data]);

  return { ...query, metrics };
}
