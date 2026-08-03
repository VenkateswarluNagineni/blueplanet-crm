'use client';

import React from 'react';
import {
  LOGISTICS_STEPS,
  LOGISTICS_STATUS_INDEX,
  type PoLogisticsStatus,
} from '@/lib/domain/logistics-stages';

/**
 * Shared progress strip for PO logistics — Purchasing rows + Logistics + Vendor.
 * Uses emerald (done) / vein gold (active) / basalt (pending).
 */
export function LogisticsStageBar({
  status,
  variant = 'full',
}: {
  status: PoLogisticsStatus;
  /** compact = dots only (dense tables); full = icons + labels */
  variant?: 'full' | 'compact';
}) {
  const currentIdx = LOGISTICS_STATUS_INDEX[status] ?? 0;

  if (variant === 'compact') {
    return (
      <div className="flex items-center w-full max-w-md py-2" aria-label={`Logistics stage: ${status}`}>
        {LOGISTICS_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 border ${
                  done
                    ? 'bg-[var(--color-emerald)] border-[var(--color-emerald)]'
                    : active
                      ? 'bg-[var(--color-vein)] border-[var(--color-vein)] shadow-[0_0_6px_rgba(227,193,108,0.5)]'
                      : 'bg-[var(--color-basalt-800)] border-[var(--color-basalt-500)]'
                }`}
                title={step.longLabel}
              />
              {idx < LOGISTICS_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-0.5 ${done ? 'bg-[var(--color-emerald)]' : 'bg-[var(--color-basalt-500)]'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center w-full py-1" aria-label={`Logistics stage: ${status}`}>
      {LOGISTICS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  done
                    ? 'bg-[var(--color-emerald)] border-[var(--color-emerald)] text-[var(--color-basalt-950)]'
                    : active
                      ? 'bg-[var(--color-vein)] border-[var(--color-vein)] text-[var(--color-basalt-950)] shadow-[0_0_8px_rgba(227,193,108,0.45)]'
                      : 'bg-[var(--color-basalt-800)] border-[var(--color-basalt-500)] text-[var(--color-text-secondary)]'
                }`}
              >
                <Icon size={14} />
              </div>
              <span
                className={`text-[10px] mt-1 whitespace-nowrap ${
                  active
                    ? 'text-[var(--color-vein)] font-medium'
                    : done
                      ? 'text-[var(--color-emerald)]'
                      : 'text-[var(--color-text-secondary)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < LOGISTICS_STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 -mt-4 ${done ? 'bg-[var(--color-emerald)]' : 'bg-[var(--color-basalt-500)]'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
