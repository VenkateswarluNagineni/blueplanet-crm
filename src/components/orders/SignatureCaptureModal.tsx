'use client';

import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const CHECKLIST_ITEMS = [
  'Countertops are level and seams are flush',
  'Sink, cooktop, and fixture cutouts fit and are sealed',
  'Edges and finish match the approved quote',
  'Work area has been cleaned of debris and offcuts',
];

/**
 * Install-confirmation capture: a short checklist plus a canvas-based
 * signature (signature_pad — MIT, canvas-only, no native app dependency).
 * Stores the signature as a data URI on the order, closing buyer-checklist
 * gap Q38 without a native/offline installer app initiative.
 */
export function SignatureCaptureModal({
  open,
  soNumber,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean;
  soNumber: string;
  onClose: () => void;
  onConfirm: (signatureDataUri: string) => void;
  isPending: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(20, 19, 21)',
      penColor: 'rgb(227, 193, 108)',
    });
    pad.addEventListener('endStroke', () => setIsEmpty(pad.isEmpty()));
    padRef.current = pad;
    setIsEmpty(true);
    setChecked(CHECKLIST_ITEMS.map(() => false));

    return () => {
      pad.off();
      padRef.current = null;
    };
  }, [open]);

  const allChecked = checked.every(Boolean);
  const canConfirm = allChecked && !isEmpty;

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleConfirm = () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    onConfirm(padRef.current.toDataURL('image/png'));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Installation"
      subtitle={`${soNumber} — walk the checklist, then capture a signature.`}
      width={480}
      footer={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={!canConfirm || isPending}
            onClick={handleConfirm}
            className="!bg-[var(--color-emerald)] hover:!opacity-90"
          >
            {isPending ? 'Saving…' : 'Confirm Install'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item, i) => (
            <label key={item} className="flex items-start gap-2.5 text-[13px] text-white cursor-pointer">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) =>
                  setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
                }
                className="mt-0.5 accent-[var(--color-vein)]"
              />
              {item}
            </label>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[12px] text-[var(--color-text-secondary)]">Customer signature</label>
            <button type="button" onClick={handleClear} className="text-[11px] text-[var(--color-sodalite)] hover:underline">
              Clear
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-[160px] rounded-[var(--radius-md)] border border-[var(--color-basalt-500)] touch-none"
          />
        </div>
      </div>
    </Modal>
  );
}
