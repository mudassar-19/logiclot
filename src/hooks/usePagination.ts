import { useState, useMemo, useCallback } from 'react';

export interface UsePaginationResult<T> {
  /** Current 1-based page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Total item count */
  totalItems: number;
  /** Slice of items for the current page */
  pageItems: T[];
  /** Go to a specific page */
  setPage: (p: number) => void;
  /** Change page size (resets to page 1) */
  setPageSize: (size: number) => void;
  /** Whether there's a next/prev page */
  hasNext: boolean;
  hasPrev: boolean;
}

export function usePagination<T>(
  items: T[],
  initialPageSize = 50,
): UsePaginationResult<T> {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page if items change and current page exceeds total
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const setPage = useCallback((p: number) => {
    setPageRaw(Math.max(1, Math.min(p, totalPages)));
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    pageItems,
    setPage,
    setPageSize,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
