import React from 'react';

/**
 * Institutional empty state — quiet title, one hint, one action.
 * DESIGN.md / frontend-ux-engineer: never cute, never apology fluff.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className = '',
}: {
  icon?: React.ElementType;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-16 px-6 gap-2 max-w-md mx-auto ${className}`}
    >
      {Icon && (
        <div className="mb-2 w-12 h-12 rounded-[var(--radius-lg)] border border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] flex items-center justify-center">
          <Icon size={22} className="text-[var(--color-fog-500)]" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-[15px] text-white font-medium tracking-tight">{title}</p>
      {hint && (
        <p className="text-[13px] text-[var(--color-text-secondary)] max-w-sm leading-relaxed">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
