'use client';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { filterEntries } from '@/lib/data/pokedex';
import { usePokedexIndex } from './usePokedexIndex';
import { useDebouncedValue } from './useDebouncedValue';
import { PokedexFilters, DEFAULT_FILTERS, type PokedexFilterState } from './PokedexFilters';
import { PokedexGrid, PokedexGridSkeleton } from './PokedexGrid';
import { Pagination } from './Pagination';

export const PAGE_SIZE = 48;

/** The whole `/pokedex` page body: filters, count, paginated grid. */
export function PokedexList() {
  const { entries, error } = usePokedexIndex();
  const [filters, setFilters] = useState<PokedexFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(filters.query, 200);

  const results = useMemo(
    () =>
      entries
        ? filterEntries(entries, {
            query,
            gens: filters.gens,
            types: filters.types,
            legendary: filters.legendary,
            formsMode: filters.showForms ? 'all' : 'base',
            sort: filters.sort,
          })
        : null,
    [entries, query, filters.gens, filters.types, filters.legendary, filters.showForms, filters.sort],
  );

  const totalPages = results ? Math.max(1, Math.ceil(results.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages);
  const pageEntries = results ? results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) : [];

  const onFilters = (next: PokedexFilterState) => {
    setFilters(next);
    setPage(1);
  };
  const onPage = (p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-5">
      <PokedexFilters value={filters} onChange={onFilters} count={results?.length} disabled={!entries && !error} />
      {error ? (
        <EmptyState
          title="Could not load the Pokédex"
          description={error}
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      ) : !results ? (
        <PokedexGridSkeleton />
      ) : (
        <>
          <Pagination page={safePage} totalPages={totalPages} onChange={onPage} />
          <PokedexGrid entries={pageEntries} />
          <Pagination page={safePage} totalPages={totalPages} onChange={onPage} />
        </>
      )}
    </div>
  );
}
