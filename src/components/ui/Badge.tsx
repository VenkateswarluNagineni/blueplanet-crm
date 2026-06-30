import React from 'react';

export type Tone = 'neutral' | 'blue' | 'gold' | 'green' | 'red' | 'orange';

const TONES: Record<Tone, string> = {
  neutral: 'bg-[#333234] border-[#454446] text-[#b8b6b9]',
  blue: 'bg-[#92b0ce]/10 border-[#92b0ce]/30 text-[#92b0ce]',
  gold: 'bg-[#e3c16c]/10 border-[#e3c16c]/30 text-[#e3c16c]',
  green: 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]',
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
  orange: 'bg-[#e8956b]/10 border-[#e8956b]/30 text-[#e8956b]',
};

/** A small, consistent status/label chip used across lists and drawers. */
export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

// Domain status → tone, so every status renders the same color everywhere.
const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'green', PREFERRED: 'gold', ON_HOLD: 'orange', INACTIVE: 'neutral',
  AVAILABLE: 'green', RESERVED: 'orange', COMMITTED: 'blue', SOLD: 'neutral',
  WRITTEN_OFF: 'red', ORDERED: 'blue', RECEIVED: 'blue',
  TRANSFER: 'blue', HOLD: 'gold', RELEASE: 'green', WRITE_OFF: 'red',
};

/** A status chip that maps a known domain status to its canonical tone. */
export function StatusPill({ status, className = '' }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status.toUpperCase()] ?? 'neutral';
  return <Badge tone={tone} className={className}>{status.replace(/_/g, ' ')}</Badge>;
}
