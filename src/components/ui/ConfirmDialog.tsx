'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

/**
 * Promise-based confirm modal — a drop-in replacement for native `confirm()` that
 * matches the app theme. Usage:
 *   const { confirm, confirmDialog } = useConfirm();
 *   ... if (await confirm({ title: 'Delete?', tone: 'danger' })) { ... }
 *   return (<>{confirmDialog}{rest}</>);
 */
export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; opts: ConfirmOpts; resolve?: (v: boolean) => void }>({
    open: false, opts: { title: '' },
  });

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ open: true, opts, resolve })),
    [],
  );

  const settle = useCallback((v: boolean) => {
    setState((s) => { s.resolve?.(v); return { ...s, open: false }; });
  }, []);

  const confirmDialog = state.open ? (
    <ConfirmModal opts={state.opts} onCancel={() => settle(false)} onConfirm={() => settle(true)} />
  ) : null;

  return { confirm, confirmDialog };
}

function ConfirmModal({ opts, onCancel, onConfirm }: { opts: ConfirmOpts; onCancel: () => void; onConfirm: () => void }) {
  const danger = opts.tone === 'danger';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[80]" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,420px)] bg-[#1c1c1c] border border-[#454446] rounded-xl shadow-2xl z-[81] p-6">
        <div className="flex items-start gap-3 mb-4">
          {danger && <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 shrink-0"><AlertTriangle size={18} /></div>}
          <div>
            <h3 className="text-[15px] font-medium text-white">{opts.title}</h3>
            {opts.message && <p className="text-[13px] text-[#b8b6b9] mt-1.5">{opts.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium text-[#b8b6b9] hover:text-white transition-colors">{opts.cancelLabel ?? 'Cancel'}</button>
          <button onClick={onConfirm} autoFocus className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${danger ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-[#e3c16c] hover:bg-[#d2ac55] text-black'}`}>{opts.confirmLabel ?? 'Confirm'}</button>
        </div>
      </div>
    </>
  );
}
