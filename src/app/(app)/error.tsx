'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/** App-wide error boundary: institutional retry card. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="h-full w-full bg-[var(--color-basalt-850)] flex items-center justify-center p-6">
      <div className="max-w-md w-full bp-card p-8 text-center">
        <div className="inline-flex p-3 rounded-full bg-[rgba(239,68,68,0.1)] text-[var(--color-ruby)] mb-4">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-[16px] font-medium text-white mb-1 tracking-tight">Something went wrong</h2>
        <p className="text-[13px] text-[var(--color-text-secondary)] mb-6 leading-relaxed">
          This view hit an unexpected error. You can retry — your data is safe.
        </p>
        <button type="button" onClick={reset} className="btn-primary">
          <RotateCw size={14} /> Try again
        </button>
        {error?.digest && (
          <p className="text-[10px] text-[var(--color-fog-500)] mt-4 font-mono">ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
