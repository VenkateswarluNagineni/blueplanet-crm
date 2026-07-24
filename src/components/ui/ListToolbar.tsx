'use client';

import React from 'react';
import { Search, ListFilter, X } from 'lucide-react';

/**
 * Shared data-list toolbar: search, optional filters, result count, primary CTA.
 * Designed to sit inside PageHeader children or above a table body.
 */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  resultCount,
  totalCount,
  onClear,
  clearLabel = 'Clear',
  actions,
  className = '',
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter controls (selects, chips, etc.). */
  filters?: React.ReactNode;
  /** Rows currently visible after filters. */
  resultCount?: number;
  /** Total rows before filtering (optional). */
  totalCount?: number;
  /** When set and filters/search are active, show a clear control. */
  onClear?: () => void;
  clearLabel?: string;
  /** Right-side actions (export, etc.) — primary CTAs usually live in PageHeader.actions. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const hasQuery = search.trim().length > 0;
  const showClear = !!onClear && hasQuery;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className="relative min-w-[200px] flex-1 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          data-testid="list-search"
          className="w-full pl-9 pr-8 h-9 bg-[var(--color-basalt-950)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[13px] text-white placeholder-[var(--color-fog-500)] focus:outline-none focus:border-[var(--color-sodalite)] transition-colors"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--color-fog-500)] hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filters && (
        <div className="flex items-center gap-2 flex-wrap text-[13px]">
          <ListFilter size={14} className="text-[var(--color-text-secondary)] shrink-0 hidden sm:block" aria-hidden />
          {filters}
        </div>
      )}

      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] text-[var(--color-sodalite)] hover:text-white hover:underline transition-colors"
        >
          {clearLabel}
        </button>
      )}

      <div className="flex items-center gap-3 ml-auto shrink-0">
        {typeof resultCount === 'number' && (
          <span className="text-[12px] text-[var(--color-fog-500)] tabular-nums">
            {typeof totalCount === 'number' && totalCount !== resultCount ? (
              <>
                <strong className="text-white font-medium">{resultCount}</strong>
                <span className="text-[var(--color-fog-500)]"> of {totalCount}</span>
              </>
            ) : (
              <>
                <strong className="text-white font-medium">{resultCount}</strong>
                <span className="text-[var(--color-fog-500)]"> shown</span>
              </>
            )}
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}

/** Compact status/filter chip for toolbars. */
export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-[12px] border transition-colors ${
        active
          ? 'bg-[rgba(227,193,108,0.14)] text-[var(--color-vein)] border-[rgba(227,193,108,0.4)] font-medium'
          : 'bg-[var(--color-basalt-800)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-white hover:border-[var(--color-basalt-600)]'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className={`tabular-nums ${active ? 'text-[var(--color-vein)]' : 'text-[var(--color-fog-500)]'}`}>{count}</span>
      )}
    </button>
  );
}
