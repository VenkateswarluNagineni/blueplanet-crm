import React from 'react';

/** A pulsing placeholder block. Compose these to build loading skeletons. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#333234] rounded ${className}`} />;
}

/**
 * A generic page-load skeleton: a header strip plus a grid of cards and a few table rows.
 * Rendered by route `loading.tsx` files so navigation never shows a blank pause.
 */
export function PageSkeleton({ variant = 'table' }: { variant?: 'table' | 'cards' | 'dashboard' }) {
  return (
    <div className="h-full w-full bg-[#2b2a2c] flex flex-col">
      {/* header */}
      <div className="pt-6 px-6 pb-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0 space-y-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="p-6 space-y-4">
        {variant === 'dashboard' || variant === 'cards' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: variant === 'dashboard' ? 6 : 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
