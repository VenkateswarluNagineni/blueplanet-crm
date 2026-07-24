'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Centered modal — DESIGN.md §4.5
 * basalt-800 body · basalt-900 header · Lift 3
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  width = 420,
  zIndex = 60,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** max content width in px */
  width?: number;
  zIndex?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] rounded-[var(--radius-xl)] bp-lift-3 flex flex-col max-h-[min(90vh,720px)] overflow-hidden animate-toast-in"
        style={{ maxWidth: `min(100%, ${width}px)` }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] shrink-0">
          <div className="min-w-0">
            <h2
              className="text-[16px] font-medium text-white tracking-tight truncate"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-basalt-700)] p-1.5 rounded-[var(--radius-md)] transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
