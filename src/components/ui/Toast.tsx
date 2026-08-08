'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info' | 'reserve';
type ToastItem = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<{ toast: (message: string, kind?: ToastKind) => void } | null>(null);

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info, reserve: CheckCircle2 } as const;
const COLOR = {
  success: '#10b981',
  error: '#ef4444',
  info: '#92b0ce',
  reserve: '#e3c16c',
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'reserve' ? 4500 : 3800);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2.5rem)]" role="region" aria-label="Notifications">
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`animate-toast-in bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-[var(--radius-xl)] bp-lift-3 px-4 py-3 flex items-start gap-3 ${
                t.kind === 'reserve' ? 'bp-toast-reserve' : ''
              }`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" style={{ color: COLOR[t.kind] }} />
              <p className="text-[13px] text-white flex-1 leading-snug">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-[var(--color-text-secondary)] hover:text-white transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.toast;
}
