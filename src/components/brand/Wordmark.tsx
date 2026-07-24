import React from 'react';

/**
 * BluePlanet mark — three stacked strata (gold vein, sodalite blue, basalt),
 * a nod to layered stone in section. Pairs with the Fraunces wordmark.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#161517" stroke="#3f3e41" />
      <rect x="7" y="8" width="18" height="3.5" rx="1.5" fill="#e3c16c" />
      <rect x="7" y="14.25" width="18" height="3.5" rx="1.5" fill="#92b0ce" />
      <rect x="7" y="20.5" width="18" height="3.5" rx="1.5" fill="#5c5b5f" />
    </svg>
  );
}

export function Wordmark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} />
      <span
        className="text-white tracking-tight leading-none"
        style={{
          fontFamily: 'var(--font-heading), var(--font-fraunces), Georgia, serif',
          fontSize: Math.round(size * 0.58),
          fontWeight: 600,
        }}
      >
        BluePlanet
      </span>
    </div>
  );
}
