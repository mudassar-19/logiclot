import type { DashboardMetrics } from '@/hooks/useDashboardData';

// Seeded PRNG for stable per-session demo numbers
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getSeed(): number {
  const today = new Date().toISOString().split('T')[0];
  let stored = sessionStorage.getItem('demo_seed');
  if (!stored || sessionStorage.getItem('demo_seed_date') !== today) {
    stored = String(Array.from(today).reduce((a, c) => a + c.charCodeAt(0), 0) * 7919);
    sessionStorage.setItem('demo_seed', stored);
    sessionStorage.setItem('demo_seed_date', today);
  }
  return parseInt(stored);
}

const OPPORTUNITY_COLORS = [
  'hsl(224, 100%, 52%)',
  'hsl(145, 63%, 42%)',
  'hsl(35, 91%, 50%)',
  'hsl(280, 68%, 55%)',
  'hsl(190, 80%, 42%)',
];

export function generateDemoMetrics(): DashboardMetrics {
  const rng = seededRandom(getSeed());
  const r = (min: number, max: number) => Math.round(min + rng() * (max - min));

  const vehiclesAnalyzed = r(1100, 1400);
  const hoursSaved = Math.round(vehiclesAnalyzed * 0.012 * 10) / 10;
  const opportunitiesFound = r(35, 55);

  const opportunities = [
    { name: 'Toyota Camry', profit: r(3600, 4200) },
    { name: 'Honda Accord', profit: r(3300, 3900) },
    { name: 'Lexus RX', profit: r(2900, 3500) },
    { name: 'BMW 3 Series', profit: r(2600, 3200) },
    { name: 'Ford F150', profit: r(2400, 3000) },
  ];

  const potentialProfit = opportunities.reduce((s, o) => s + o.profit, 0) + r(80000, 100000);

  const topOpportunities = opportunities.map((o, i) => ({
    name: o.name,
    profit: o.profit,
    pct: Math.round((o.profit / potentialProfit) * 100),
    color: OPPORTUNITY_COLORS[i],
  }));

  const profitNotes = [
    { label: 'Toyota Camry', amount: `est profit $${opportunities[0].profit.toLocaleString()}` },
    { label: 'Lexus RX', amount: `est profit $${opportunities[2].profit.toLocaleString()}` },
  ];

  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  const vehiclesTrend = months.map(m => ({ m, v: r(140, 220) }));
  const hoursTrend = months.map(m => ({ m, v: Math.round(r(10, 18) * 10) / 10 }));
  const opportunitiesTrend = months.map(m => ({ m, v: r(4, 10) }));

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
}
