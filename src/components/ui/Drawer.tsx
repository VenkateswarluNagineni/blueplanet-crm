'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * A right-side slide-over shell with a backdrop, a header (title + close), a scrollable
 * body, and an optional sticky footer. Closes on Escape. Widths are responsive: full
 * width on small screens, `width` (default 640px) on larger ones.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  width = 640,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed top-0 right-0 h-full w-full bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col"
        style={{ maxWidth: `min(100vw, ${width}px)` }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
          <div className="min-w-0">
            <h2 className="text-[18px] font-medium text-white truncate">{title}</h2>
            {subtitle && <p className="text-[13px] text-[#b8b6b9] mt-1 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {headerExtra}
            <button onClick={onClose} aria-label="Close" className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors"><X size={20} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="p-4 border-t border-[#454446] bg-[#1c1c1c] flex items-center justify-end gap-3 shrink-0">{footer}</div>}
      </div>
    </>
  );
}
