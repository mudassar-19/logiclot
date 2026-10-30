export interface DashboardCacheData {
  vehicleCount: number;
  purchasedCount: number;
  passedCount: number;
  totalSpend: number;
  totalProfitValue: number;
  avgDaysSupply: number;
  flaggedPct: number;
  avgReconEst: number;
  totalSavings: number;
  bestBuyText: string;
  overMaxBidText: string;
  uploadsToday: number;
  uploadsThisMonth: number;
  chartData: { week: string; profit: number }[];
  runListCounts: Record<string, { total: number; rec: number }>;
}

interface CacheEntry {
  data: DashboardCacheData;
  fetchedAt: number;
}

const DASHBOARD_CACHE = new Map<string, CacheEntry>();

/**
 * Get cached dashboard data if within TTL (1 minute).
 */
export function getCachedDashboardData(organizationId: string): DashboardCacheData | null {
  const cached = DASHBOARD_CACHE.get(organizationId);
  if (cached && Date.now() - cached.fetchedAt < 60 * 1000) {
    return cached.data;
  }
  return null;
}

/**
 * Set dashboard data in the cache.
 */
export function setCachedDashboardData(organizationId: string, data: DashboardCacheData): void {
  DASHBOARD_CACHE.set(organizationId, {
    data,
    fetchedAt: Date.now(),
  });
}

/**
 * Invalidate the dashboard cache.
 */
export function invalidateDashboardCache(organizationId: string): void {
  DASHBOARD_CACHE.delete(organizationId);
}
