import React from 'react';

export type Tone = 'neutral' | 'blue' | 'gold' | 'green' | 'red' | 'orange';

const TONES: Record<Tone, string> = {
  neutral:
    'bg-[var(--color-basalt-700)] border-[var(--color-basalt-500)] text-[var(--color-text-secondary)]',
  blue: 'bg-[rgba(146,176,206,0.1)] border-[rgba(146,176,206,0.3)] text-[var(--color-sodalite)]',
  gold: 'bg-[rgba(227,193,108,0.1)] border-[rgba(227,193,108,0.3)] text-[var(--color-vein)]',
  green: 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.25)] text-[var(--color-emerald)]',
  red: 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)] text-[var(--color-ruby)]',
  orange: 'bg-[rgba(232,149,107,0.1)] border-[rgba(232,149,107,0.3)] text-[var(--color-coral)]',
};

/** Status/label chip — DESIGN.md §4.4 */
export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-medium border ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'green',
  PREFERRED: 'gold',
  ON_HOLD: 'gold', // reserved / held — thin gold language (ceremony)
  INACTIVE: 'neutral',
  AVAILABLE: 'green',
  RESERVED: 'gold',
  COMMITTED: 'blue',
  SOLD: 'neutral',
  WRITTEN_OFF: 'red',
  ORDERED: 'blue',
  RECEIVED: 'blue',
  TRANSFER: 'blue',
  HOLD: 'gold',
  RELEASE: 'green',
  WRITE_OFF: 'red',
  PRODUCTION: 'blue',
  ON_WATER: 'blue',
  CUSTOMS: 'orange',
  INLAND_TRANSIT: 'blue',
  PLACED: 'gold',
  COMPLETED: 'green',
  CANCELLED: 'red',
  LEAD: 'neutral',
  QUOTED: 'blue',
  NEGOTIATION: 'gold',
  CLOSED_WON: 'green',
  CLOSED_LOST: 'red',
};

const STATUS_LABEL: Record<string, string> = {
  ON_HOLD: 'On hold',
  WRITTEN_OFF: 'Written off',
  CLOSED_WON: 'Closed won',
  CLOSED_LOST: 'Closed lost',
};

/** Domain status → canonical tone everywhere. Held = quiet gold (reservation ceremony). */
export function StatusPill({
  status,
  className = '',
  title,
}: {
  status: string;
  className?: string;
  /** Optional tooltip (e.g. hold reason). */
  title?: string;
}) {
  const key = status.toUpperCase();
  const tone = STATUS_TONE[key] ?? 'neutral';
  const label = STATUS_LABEL[key] ?? status.replace(/_/g, ' ');
  const held = key === 'ON_HOLD' || key === 'RESERVED';
  return (
    <Badge
      tone={tone}
      className={`${held ? 'bp-status-held' : ''} ${className}`.trim()}
    >
      <span title={title}>{label}</span>
    </Badge>
  );
}
