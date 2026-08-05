'use client';

import { useState } from 'react';
import type { InventoryRow } from '@/server/inventory/queries';
import { Modal } from '@/components/ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  left: InventoryRow;
  right: InventoryRow;
};

/**
 * Digital book-match preview — two sibling slabs' cover photos side by side,
 * with the right panel mirrored by default (book-matched slabs are cut
 * sequentially from the same block and are mirror images of each other
 * across the seam). Built on the block-mates + slab-photo foundation.
 */
export function BookMatchPreviewModal({ open, onClose, left, right }: Props) {
  const [mirrorRight, setMirrorRight] = useState(true);
  const [mirrorLeft, setMirrorLeft] = useState(false);

  const leftPhoto = left.photos[0];
  const rightPhoto = right.photos[0];
  if (!leftPhoto || !rightPhoto) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book-match preview"
      subtitle="A digital preview only — confirm veining alignment against the physical slabs before cutting."
      width={760}
      zIndex={85}
    >
      <div className="grid grid-cols-2 gap-px bg-[var(--color-basalt-500)] rounded-[var(--radius-md)] overflow-hidden">
        {[
          { slab: left, photo: leftPhoto, mirrored: mirrorLeft, setMirrored: setMirrorLeft },
          { slab: right, photo: rightPhoto, mirrored: mirrorRight, setMirrored: setMirrorRight },
        ].map(({ slab, photo, mirrored, setMirrored }) => (
          <div key={slab.id} className="bg-[var(--color-basalt-900)] p-3">
            <div className="aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-basalt-800)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/slab-photos/${photo.id}`}
                alt={`${slab.uniqueSlabId} photo`}
                className="w-full h-full object-cover"
                style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="bp-mono text-[11px] text-white truncate" title={slab.uniqueSlabId}>
                {slab.uniqueSlabId}
              </p>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-fog-500)] cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={mirrored}
                  onChange={(e) => setMirrored(e.target.checked)}
                  className="accent-[var(--color-vein)]"
                />
                Mirror
              </label>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
