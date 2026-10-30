import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '@/hooks/usePagination';

function makeItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
}

describe('usePagination', () => {
  it('returns first page of items', () => {
    const items = makeItems(150);
    const { result } = renderHook(() => usePagination(items, 50));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(50);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(150);
    expect(result.current.pageItems).toHaveLength(50);
    expect(result.current.pageItems[0]).toEqual({ id: 1, name: 'Item 1' });
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrev).toBe(false);
  });

  it('navigates to page 2', () => {
    const items = makeItems(150);
    const { result } = renderHook(() => usePagination(items, 50));

    act(() => result.current.setPage(2));

    expect(result.current.page).toBe(2);
    expect(result.current.pageItems[0]).toEqual({ id: 51, name: 'Item 51' });
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrev).toBe(true);
  });

  it('navigates to last page', () => {
    const items = makeItems(150);
    const { result } = renderHook(() => usePagination(items, 50));

    act(() => result.current.setPage(3));

    expect(result.current.page).toBe(3);
    expect(result.current.pageItems).toHaveLength(50);
    expect(result.current.pageItems[0]).toEqual({ id: 101, name: 'Item 101' });
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrev).toBe(true);
  });

  it('clamps page to valid range', () => {
    const items = makeItems(100);
    const { result } = renderHook(() => usePagination(items, 50));

    act(() => result.current.setPage(999));
    expect(result.current.page).toBe(2);

    act(() => result.current.setPage(-5));
    expect(result.current.page).toBe(1);
  });

  it('handles page size change and resets to page 1', () => {
    const items = makeItems(200);
    const { result } = renderHook(() => usePagination(items, 50));

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setPageSize(100));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(100);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.pageItems).toHaveLength(100);
  });

  it('handles empty items', () => {
    const { result } = renderHook(() => usePagination([], 50));
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.pageItems).toEqual([]);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrev).toBe(false);
  });

  it('handles 20,000 items without issues', () => {
    const items = makeItems(20_000);
    const { result } = renderHook(() => usePagination(items, 50));

    expect(result.current.totalPages).toBe(400);
    expect(result.current.pageItems).toHaveLength(50);

    act(() => result.current.setPage(400));
    expect(result.current.pageItems).toHaveLength(50);
    expect(result.current.pageItems[49]).toEqual({ id: 20_000, name: 'Item 20000' });
  });

  it('clamps page when items array shrinks', () => {
    const items = makeItems(200);
    const { result, rerender } = renderHook(
      ({ data }) => usePagination(data, 50),
      { initialProps: { data: items } },
    );

    act(() => result.current.setPage(4));
    expect(result.current.page).toBe(4);

    // Shrink to 100 items (2 pages) — page should clamp from 4 to 2
    rerender({ data: items.slice(0, 100) });
    expect(result.current.page).toBe(2);
    expect(result.current.totalPages).toBe(2);
  });

  it('items below first pageSize option show no pages needed', () => {
    const items = makeItems(10);
    const { result } = renderHook(() => usePagination(items, 50));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toHaveLength(10);
  });
});
