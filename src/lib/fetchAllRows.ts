import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

const PAGE_SIZE = 1000;

/**
 * Fetches all rows from a Supabase query by paginating in chunks of 1000.
 * Accepts a builder factory so the caller controls table, select, and filters.
 *
 * Usage:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from('auction_vehicles').select('*').eq('run_list_id', id).range(from, to)
 *   );
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  queryFactory: (from: number, to: number) => PostgrestFilterBuilder<any, any, T[]>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryFactory(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}
