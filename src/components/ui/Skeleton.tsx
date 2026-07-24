import React from 'react';

/** Pulsing basalt block — compose for loading skeletons. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[var(--color-basalt-700)] rounded-[var(--radius-md)] ${className}`}
      aria-hidden
    />
  );
}

/**
 * Page-load skeleton matching command center / table chrome.
 * Used by route `loading.tsx` files.
 */
export function PageSkeleton({ variant = 'table' }: { variant?: 'table' | 'cards' | 'dashboard' }) {
  return (
    <div
      className="h-full w-full bg-[var(--color-basalt-850)] flex flex-col"
      role="status"
      aria-label="Loading"
    >
      <div className="bp-header-chrome pt-5 px-6 pb-4 shrink-0 space-y-3">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3 w-80 max-w-full" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <div className="p-6 space-y-4">
        {variant === 'dashboard' || variant === 'cards' ? (
          <>
            <Skeleton className="h-20 w-full rounded-[var(--radius-xl)]" />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {Array.from({ length: variant === 'dashboard' ? 6 : 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-[var(--radius-lg)]" />
              ))}
            </div>
            {variant === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                <Skeleton className="h-56 rounded-[var(--radius-lg)]" />
                <Skeleton className="h-56 rounded-[var(--radius-lg)]" />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="bp-table-shell p-0 overflow-hidden">
              <div className="space-y-0">
                <Skeleton className="h-11 w-full !rounded-none" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full !rounded-none border-t border-[var(--color-basalt-800)]" />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
