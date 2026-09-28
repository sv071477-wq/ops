"use client";

import { useState, useCallback, useMemo } from "react";

export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const totalPages = useMemo(() => Math.ceil(items.length / pageSize), [items.length, pageSize]);

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page]);
  const prevPage = useCallback(() => goToPage(page - 1), [goToPage, page]);

  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    totalPages,
    totalItems: items.length,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}