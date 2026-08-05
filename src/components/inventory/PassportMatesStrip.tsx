'use client';

import { useState } from 'react';
import { BookOpen, Layers } from 'lucide-react';
import type { InventoryRow } from '@/server/inventory/queries';
import { StatusPill } from '@/components/ui/Badge';
import { swatchBaseForMaterial } from '@/lib/domain/material-swatch';
import { BookMatchPreviewModal } from '@/components/inventory/BookMatchPreviewModal';

type Props = {
  currentSlab: InventoryRow;
  mates: InventoryRow[];
  onSelect: (slab: InventoryRow) => void;
};

/** Horizontal block-family strip — siblings from the same lot / bundle (H3.1). */
export function PassportMatesStrip({ currentSlab, mates, onSelect }: Props) {
  const [previewMate, setPreviewMate] = useState<InventoryRow | null>(null);

  if (mates.length === 0) return null;

  return (
    <div
      className="px-6 py-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-850)]"
      data-testid="passport-mates-strip"
    >
      <div className="flex items-center gap-2 mb-3">
        <Layers size={14} className="text-[var(--color-sodalite)] shrink-0" aria-hidden />
        <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-fog-400)] font-medium">
          Block family · {mates.length} mate{mates.length === 1 ? '' : 's'}
        </h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {mates.map((mate) => (
          <div
            key={mate.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(mate)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(mate);
              }
            }}
            data-testid={`passport-mate-${mate.uniqueSlabId}`}
            className="relative shrink-0 w-[148px] text-left rounded-[var(--radius-md)] border border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] p-2.5 hover:border-[rgba(227,193,108,0.35)] hover:bg-[var(--color-basalt-800)] transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-vein)]"
          >
            {currentSlab.photos.length > 0 && mate.photos.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewMate(mate);
                }}
                title="Preview book-match"
                data-testid={`book-match-preview-${mate.uniqueSlabId}`}
                className="absolute top-1.5 right-1.5 p-1 rounded-[var(--radius-sm)] bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <BookOpen size={11} />
              </button>
            )}
            <div className="flex items-start gap-2">
              {mate.photos.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/slab-photos/${mate.photos[0].id}`}
                  alt=""
                  aria-hidden
                  className="shrink-0 w-8 h-8 rounded-[var(--radius-sm)] object-cover border border-[var(--color-basalt-500)]"
                />
              ) : (
                <div
                  className="bp-swatch shrink-0 w-8 h-8 rounded-[var(--radius-sm)]"
                  style={{
                    ['--swatch-base' as string]: swatchBaseForMaterial(
                      mate.product.materialType,
                      mate.product.baseColor,
                    ),
                  }}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="bp-mono text-[11px] text-white truncate" title={mate.uniqueSlabId}>
                  {mate.uniqueSlabId}
                </p>
                <p className="text-[10px] text-[var(--color-fog-500)] truncate mt-0.5" title={mate.location.name}>
                  {mate.location.name}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-1">
              <StatusPill status={mate.status} />
              <span className="text-[10px] text-[var(--color-fog-500)] tabular-nums">{mate.totalSf} sf</span>
            </div>
          </div>
        ))}
      </div>
      {previewMate && (
        <BookMatchPreviewModal
          open
          onClose={() => setPreviewMate(null)}
          left={currentSlab}
          right={previewMate}
        />
      )}
    </div>
  );
}
