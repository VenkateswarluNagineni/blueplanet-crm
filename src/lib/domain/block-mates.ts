import type { InventoryRow } from '@/server/inventory/queries';

/** Preferred display order for block-mate strips (yard ops first). */
const STATUS_ORDER: Record<string, number> = {
  AVAILABLE: 0,
  ON_HOLD: 1,
  COMMITTED: 2,
  RECEIVED: 3,
  ORDERED: 4,
  SOLD: 5,
  WRITTEN_OFF: 6,
};

/**
 * Sibling slabs from the same quarry lot or bundle — powers passport block-mates strip (H3.1).
 * Uses in-memory inventory rows already loaded for the page (no extra round-trip).
 */
export function getBlockMates(
  slab: Pick<InventoryRow, 'id' | 'lotNumber' | 'bundleId'>,
  all: InventoryRow[],
  limit = 12,
): InventoryRow[] {
  const lot = slab.lotNumber?.trim();
  const bundle = slab.bundleId?.trim();
  if (!lot && !bundle) return [];

  return all
    .filter((item) => {
      if (item.id === slab.id) return false;
      const matchLot = !!lot && item.lotNumber?.trim() === lot;
      const matchBundle = !!bundle && item.bundleId?.trim() === bundle;
      return matchLot || matchBundle;
    })
    .sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      const loc = a.location.name.localeCompare(b.location.name);
      if (loc !== 0) return loc;
      return a.uniqueSlabId.localeCompare(b.uniqueSlabId);
    })
    .slice(0, limit);
}
