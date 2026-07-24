'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Right-side slide-over — DESIGN.md §4.5
 * basalt-800 body · basalt-900 header · Lift 3
 *
 * Pass `header` for a fully custom hero (e.g. Material Passport museum label).
 * Pass `title` for the standard title bar.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  header,
  headerExtra,
  footer,
  width = 640,
  children,
  testId,
  zIndex = 50,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Replaces the default title bar entirely (passport hero, etc.) */
  header?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
  testId?: string;
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
    <>
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        className="bp-drawer-panel fixed top-0 right-0 h-full w-full bg-[var(--color-basalt-800)] border-l border-[var(--color-basalt-500)] flex flex-col"
        style={{ maxWidth: `min(100vw, ${width}px)`, zIndex: zIndex + 1 }}
      >
        {header ? (
          header
        ) : (
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] shrink-0">
            <div className="min-w-0">
              {title != null && (
                <h2
                  className="text-[18px] font-medium text-white truncate tracking-tight"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-[13px] text-[var(--color-text-secondary)] mt-1 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {headerExtra}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-basalt-700)] p-1.5 rounded-[var(--radius-md)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer && (
          <div className="p-4 border-t border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
