import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drives a server-paginated list. `fetcher` receives the query params
 * ({ page, limit, search, sortBy, sortOrder }) and should return either the
 * backend envelope `{ items, meta }` or a bare array (mock/demo mode).
 *
 * Example:
 *   const patients = usePaginatedResource(
 *     (params) => patientService.list(client, params)
 *   );
 *   // patients.items, patients.meta, <Pagination meta={patients.meta} onPageChange={patients.setPage} />
 */
export function usePaginatedResource(
  fetcher,
  { initialPage = 1, initialLimit = 20, initialSearch = '', initialSort = { sortBy: undefined, sortOrder: 'desc' }, searchDebounceMs = 300 } = {}
) {
  const [page, setPageState] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearchState] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Keep the latest fetcher without making it a fetch dependency (callers often
  // pass an inline arrow, which would otherwise refetch on every render).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Debounce the search term so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, searchDebounceMs]);

  const setPage = useCallback((next) => {
    setPageState((current) => Math.max(1, typeof next === 'function' ? next(current) : next));
  }, []);

  // Changing the query resets to the first page.
  const setSearch = useCallback((value) => {
    setPageState(1);
    setSearchState(value);
  }, []);

  const setSortAndReset = useCallback((next) => {
    setPageState(1);
    setSort((current) => (typeof next === 'function' ? next(current) : next));
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    Promise.resolve(
      fetcherRef.current({
        page,
        limit,
        search: debouncedSearch || undefined,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder
      })
    )
      .then((result) => {
        if (ignore) return;
        const list = Array.isArray(result) ? result : result?.items ?? [];
        setItems(list);
        setMeta(Array.isArray(result) ? null : result?.meta ?? null);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err);
        setItems([]);
        setMeta(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [page, limit, debouncedSearch, sort.sortBy, sort.sortOrder, reloadToken]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    items,
    meta,
    loading,
    error,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    sort,
    setSort: setSortAndReset,
    refresh
  };
}
