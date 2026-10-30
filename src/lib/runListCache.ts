/**
 * Shared session cache for auction_run_lists metadata.
 *
 * Both the Dashboard and the BuyList picker show the same list of run lists.
 * Without a cache, every navigation between the two pages fires a full
 * paginated fetchAllRows against auction_run_lists.
 *
 * This module provides a lightweight in-memory store keyed by organization_id
 * so that within the same browser session, the list is fetched at most once
 * per CACHE_TTL_MS window.  The cache is invalidated automatically after an
 * upload so the new run list appears immediately.
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface RunListRow {
  id: string;
  file_name: string;
  auction_source: string | null;
  auction_name: string | null;
  auction_date: string | null;
  status: string;
  parse_error: string | null;
  created_at: string;
}

interface CacheEntry {
  rows: RunListRow[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute — short enough to reflect new uploads quickly

const RUN_LIST_CACHE = new Map<string, CacheEntry>();

/** In-flight map prevents duplicate concurrent fetches for the same org. */
const IN_FLIGHT_RL = new Map<string, Promise<RunListRow[]>>();

/**
 * Fetch (or return cached) auction_run_lists for the given organization.
 * Subsequent calls within CACHE_TTL_MS return the same array instantly.
 */
export async function fetchRunLists(organizationId: string): Promise<RunListRow[]> {
  const cached = RUN_LIST_CACHE.get(organizationId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rows;
  }

  // Deduplicate concurrent calls (e.g. Dashboard + BuyList mounting simultaneously)
  if (IN_FLIGHT_RL.has(organizationId)) {
    return IN_FLIGHT_RL.get(organizationId)!;
  }

  const promise = fetchAllRows<RunListRow>((from, to) =>
    supabase
      .from('auction_run_lists')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(from, to)
  ).then((rows) => {
    RUN_LIST_CACHE.set(organizationId, { rows, fetchedAt: Date.now() });
    IN_FLIGHT_RL.delete(organizationId);
    return rows;
  }).catch((err) => {
    IN_FLIGHT_RL.delete(organizationId);
    throw err;
  });

  IN_FLIGHT_RL.set(organizationId, promise);
  return promise;
}

/**
 * Call this after uploading a new run list (or any mutation) to force
 * the next fetchRunLists call to hit Supabase fresh.
 */
export function invalidateRunListsCache(organizationId: string): void {
  RUN_LIST_CACHE.delete(organizationId);
}
