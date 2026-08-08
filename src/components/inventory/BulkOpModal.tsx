import type { InventoryLocation } from '@/server/inventory/queries';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { BulkOp } from '@/components/inventory/InventoryTableClient';

export function BulkOpModal({
  bulkOp,
  onClose,
  selectedCount,
  bulkDestId,
  setBulkDestId,
  bulkReason,
  setBulkReason,
  locations,
  isPending,
  onConfirm,
}: {
  bulkOp: BulkOp | null;
  onClose: () => void;
  selectedCount: number;
  bulkDestId: string;
  setBulkDestId: (v: string) => void;
  bulkReason: string;
  setBulkReason: (v: string) => void;
  locations: InventoryLocation[];
  isPending: boolean;
  onConfirm: () => void;
}) {
  const TITLES: Record<BulkOp, string> = {
    TRANSFER: 'Transfer slabs',
    HOLD: 'Hold slabs',
    RELEASE: 'Release hold',
    WRITE_OFF: 'Write off slabs',
  };
  const SUBTITLES: Record<BulkOp, string> = {
    TRANSFER: `${selectedCount} selected. Only non-sold slabs move.`,
    HOLD: `${selectedCount} selected. Only AVAILABLE slabs are held — quiet reservation, not a sale.`,
    RELEASE: `${selectedCount} selected. Only slabs currently on hold return to AVAILABLE.`,
    WRITE_OFF: `${selectedCount} selected. Permanent removal from sellable stock.`,
  };
  const needsReason = bulkOp === 'HOLD' || bulkOp === 'WRITE_OFF';
  const disabled =
    isPending ||
    (bulkOp === 'TRANSFER' && !bulkDestId) ||
    (needsReason && !bulkReason.trim());
  const confirmLabel =
    bulkOp === 'HOLD'
      ? isPending
        ? 'Holding…'
        : 'Confirm hold'
      : bulkOp === 'RELEASE'
        ? isPending
          ? 'Releasing…'
          : 'Release to available'
        : isPending
          ? 'Working…'
          : 'Confirm';

  return (
    <Modal
      open={!!bulkOp}
      onClose={onClose}
      title={bulkOp ? TITLES[bulkOp] : ''}
      subtitle={bulkOp ? SUBTITLES[bulkOp] : undefined}
      width={440}
      zIndex={60}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={bulkOp === 'WRITE_OFF' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {bulkOp === 'TRANSFER' && (
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
              Destination warehouse
            </label>
            <select
              value={bulkDestId}
              onChange={(e) => setBulkDestId(e.target.value)}
              className="bp-select w-full"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
              Note (optional)
            </label>
            <input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="e.g. Rebalancing showroom stock"
              className="bp-input"
            />
          </div>
        </div>
      )}
      {bulkOp === 'HOLD' && (
        <div className="space-y-3">
          <div className="rounded-[var(--radius-md)] border border-[rgba(227,193,108,0.28)] bg-[rgba(227,193,108,0.06)] px-3 py-2.5">
            <p className="text-[12px] text-[var(--color-vein)] font-medium mb-0.5">Reservation</p>
            <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
              Status becomes <strong className="text-white font-medium">On hold</strong> with a gold mark in the list.
              Not a sale — release when the deal walks or convert from Pipeline.
            </p>
          </div>
          <div>
            <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
              Held for <span className="text-[var(--color-ruby)]">*</span>
            </label>
            <input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="Customer, quote #, or project"
              className="bp-input"
              autoFocus
              maxLength={200}
              data-testid="hold-reason-input"
            />
          </div>
        </div>
      )}
      {bulkOp === 'WRITE_OFF' && (
        <div>
          <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
            Reason <span className="text-[var(--color-ruby)]">*</span>
          </label>
          <input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="e.g. Damaged in handling"
            className="bp-input"
          />
          <p className="text-[11px] text-[var(--color-coral)] mt-2">
            Write-off is permanent — slabs are removed from sellable inventory.
          </p>
        </div>
      )}
      {bulkOp === 'RELEASE' && (
        <div className="space-y-2">
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
            Return selected held slabs to <strong className="text-white font-medium">Available</strong>.
            Hold reason is cleared; the release is audited.
          </p>
        </div>
      )}
    </Modal>
  );
}
