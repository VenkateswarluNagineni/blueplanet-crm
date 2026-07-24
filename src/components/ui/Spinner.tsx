import React from 'react';

/** A small inline loading spinner. */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-[var(--color-basalt-500)] border-t-[#92b0ce] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
