/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { fetchAllRows } from '@/lib/fetchAllRows';

// Mock a Supabase-like query builder that returns paginated data
function mockQueryFactory(totalRows: number) {
  const allRows = Array.from({ length: totalRows }, (_, i) => ({ id: i + 1 }));

  return (from: number, to: number) => {
    const slice = allRows.slice(from, to + 1);
    return Promise.resolve({ data: slice, error: null }) as any;
  };
}

function mockErrorFactory() {
  return (_from: number, _to: number) => {
    return Promise.resolve({ data: null, error: new Error('DB error') }) as any;
  };
}

describe('fetchAllRows', () => {
  it('returns all rows when count < 1000', async () => {
    const rows = await fetchAllRows(mockQueryFactory(500));
    expect(rows).toHaveLength(500);
    expect(rows[0]).toEqual({ id: 1 });
    expect(rows[499]).toEqual({ id: 500 });
  });

  it('paginates through exactly 1000 rows', async () => {
    const rows = await fetchAllRows(mockQueryFactory(1000));
    expect(rows).toHaveLength(1000);
  });

  it('paginates through 2500 rows (3 pages)', async () => {
    const rows = await fetchAllRows(mockQueryFactory(2500));
    expect(rows).toHaveLength(2500);
    expect(rows[0]).toEqual({ id: 1 });
    expect(rows[999]).toEqual({ id: 1000 });
    expect(rows[1000]).toEqual({ id: 1001 });
    expect(rows[2499]).toEqual({ id: 2500 });
  });

  it('handles 20,000+ rows', async () => {
    const rows = await fetchAllRows(mockQueryFactory(20_000));
    expect(rows).toHaveLength(20_000);
    expect(rows[19_999]).toEqual({ id: 20_000 });
  });

  it('returns empty array for empty table', async () => {
    const rows = await fetchAllRows(mockQueryFactory(0));
    expect(rows).toEqual([]);
  });

  it('throws on query error', async () => {
    await expect(fetchAllRows(mockErrorFactory())).rejects.toThrow('DB error');
  });
});
