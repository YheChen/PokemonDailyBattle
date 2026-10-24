'use client';
import { Button } from '@/components/ui/Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

/** Prev / page x of y / next controls. */
export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className={className} aria-label="Pagination">
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => onChange(1)} disabled={page <= 1} aria-label="First page">
          «
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          Prev
        </Button>
        <span className="font-pixel text-xl tabular-nums" aria-current="page">
          Page {page} / {totalPages}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange(totalPages)} disabled={page >= totalPages} aria-label="Last page">
          »
        </Button>
      </div>
    </nav>
  );
}
