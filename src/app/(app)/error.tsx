'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/** App-wide error boundary: a friendly retry card instead of a crashed segment. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="h-full w-full bg-[#2b2a2c] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#1c1c1c] border border-[#454446] rounded-xl p-8 text-center">
        <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-400 mb-4"><AlertTriangle size={24} /></div>
        <h2 className="text-[16px] font-medium text-white mb-1">Something went wrong</h2>
        <p className="text-[13px] text-[#b8b6b9] mb-6">This view hit an unexpected error. You can retry — your data is safe.</p>
        <button onClick={reset} className="inline-flex items-center gap-2 bg-[#e3c16c] text-black px-4 py-2 rounded-md text-[13px] font-medium hover:bg-[#d2ac55] transition-colors">
          <RotateCw size={14} /> Try again
        </button>
        {error?.digest && <p className="text-[10px] text-[#7d7c7f] mt-4 font-mono">ref: {error.digest}</p>}
      </div>
    </div>
  );
}
