'use client';

import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lightweight, portal-based hover tooltip. Rendered to document.body so it is
 * never clipped by overflow-hidden tables/drawers, and flips to stay on-screen.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  className = '',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  const [coords, setCoords] = useState<{ x: number; y: number; side: 'top' | 'bottom' } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s: 'top' | 'bottom' = side === 'top' && r.top < 90 ? 'bottom' : side;
    setCoords({
      x: r.left + r.width / 2,
      y: s === 'top' ? r.top - 8 : r.bottom + 8,
      side: s,
    });
  }, [side]);

  const hide = useCallback(() => setCoords(null), []);

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} className={className}>
      {children}
      {coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              left: coords.x,
              top: coords.y,
              transform: `translate(-50%, ${coords.side === 'top' ? 'calc(-100% - 0px)' : '0'})`,
            }}
            className="z-[100] pointer-events-none block max-w-[270px] rounded-md border border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] px-3 py-2 text-[12px] leading-snug text-[#d9d8d9] shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

/**
 * Plain-English glossary of the trade/logistics jargon used across the app.
 * Hover any <Term k="…"> to explain it without leaving the page.
 */
export const GLOSSARY: Record<string, { term: string; def: string }> = {
  landedCost: {
    term: 'Landed Cost',
    def: 'The all-in cost of a slab once it reaches the warehouse — material price plus ocean freight, customs duties and inland trucking, all rolled in.',
  },
  fob: {
    term: 'FOB (Free On Board)',
    def: 'The price of the stone at the supplier’s port, before shipping. The buyer pays freight and insurance from that point on.',
  },
  apportioned: {
    term: 'Apportioned Freight',
    def: 'Shipping and handling costs for a whole container, divided fairly across each slab inside it.',
  },
  incoterms: {
    term: 'Incoterms',
    def: 'Standard shipping terms (e.g. FOB, CIF, DDP) that say exactly who pays for and is responsible for the goods at each leg of the journey.',
  },
  ddp: {
    term: 'DDP (Delivered Duty Paid)',
    def: 'The supplier covers everything — freight, customs and delivery — right to your door.',
  },
  cif: {
    term: 'CIF (Cost, Insurance, Freight)',
    def: 'The supplier covers ocean freight and insurance to the destination port; you handle customs and inland delivery.',
  },
  lot: {
    term: 'Lot / Container',
    def: 'The shipment batch a slab arrived in — usually the ocean container number. Slabs from the same block ship together as a lot.',
  },
  container: {
    term: 'Container',
    def: 'The sealed steel shipping container the slabs travel in across the ocean, identified by a unique number.',
  },
  eta: {
    term: 'ETA / Estimated Delivery',
    def: 'The date the shipment is expected to be received at the destination hub. Drives the on-track / overdue status.',
  },
  demurrage: {
    term: 'Demurrage Risk',
    def: 'Penalty fees charged when a container sits at the port too long before being picked up. Flagged so you can act before charges accrue.',
  },
  materialPassport: {
    term: 'Material Passport',
    def: 'The full life story of one slab — its supplier, shipping legs, costs, current location and (if sold) its customer.',
  },
  customs: {
    term: 'Customs Broker',
    def: 'The agent who clears your shipment through customs at the port of entry and handles import duties and paperwork.',
  },
  receipt: {
    term: 'Receipt Number',
    def: 'The goods-receipt / packing-slip number recorded when the container is received. Stored so the shipment can be looked up later.',
  },
  supplierCovered: {
    term: 'Supplier-covered',
    def: 'This shipping leg is arranged and paid for by the supplier, so no third-party vendor is assigned to it.',
  },
  poNumber: {
    term: 'PO Number',
    def: 'A unique purchase-order ID in the format PO-[Year]-[Sequence] (e.g. PO-2026-001), assigned automatically when the order is issued.',
  },
};

export function Term({
  k,
  children,
  className = '',
}: {
  k: keyof typeof GLOSSARY | string;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = GLOSSARY[k as string];
  const label = children ?? entry?.term ?? k;
  if (!entry) return <>{label}</>;
  return (
    <Tooltip
      content={
        <span>
          <span className="font-semibold text-white">{entry.term}</span> — {entry.def}
        </span>
      }
    >
      <span
        className={`underline decoration-dotted decoration-[#92b0ce]/70 underline-offset-2 cursor-help ${className}`}
      >
        {label}
      </span>
    </Tooltip>
  );
}
