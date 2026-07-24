'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

/**
 * Promise-based confirm — themed Modal + Button.
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (await confirm({ title: 'Delete?', tone: 'danger' })) { ... }
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    opts: ConfirmOpts;
    resolve?: (v: boolean) => void;
  }>({ open: false, opts: { title: '' } });

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setState({ open: true, opts, resolve })),
    [],
  );

  const settle = useCallback((v: boolean) => {
    setState((s) => {
      s.resolve?.(v);
      return { ...s, open: false };
    });
  }, []);

  const danger = state.opts.tone === 'danger';

  const confirmDialog = (
    <Modal
      open={state.open}
      onClose={() => settle(false)}
      title={
        <span className="flex items-center gap-2">
          {danger && (
            <span className="p-1 rounded-md bg-[rgba(239,68,68,0.12)] text-[var(--color-ruby)]">
              <AlertTriangle size={16} />
            </span>
          )}
          {state.opts.title}
        </span>
      }
      width={420}
      zIndex={80}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => settle(false)}>
            {state.opts.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            autoFocus
            onClick={() => settle(true)}
          >
            {state.opts.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      {state.opts.message ? (
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
          {state.opts.message}
        </p>
      ) : (
        <p className="text-[13px] text-[var(--color-fog-500)]">This action cannot be undone lightly.</p>
      )}
    </Modal>
  );

  return { confirm, confirmDialog };
}
