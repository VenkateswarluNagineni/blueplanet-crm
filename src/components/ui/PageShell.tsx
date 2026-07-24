import React from 'react';

/**
 * Full-height module shell: optional sticky header region + scrollable body.
 * Use with PageHeader as the `header` so every module shares the same geometry.
 */
export function PageShell({
  header,
  children,
  /** When true, body is not padded (tables that manage their own padding). */
  flush = false,
  className = '',
  bodyClassName = '',
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={`h-full w-full flex flex-col bg-[var(--color-basalt-850)] text-[var(--color-text-muted)] overflow-hidden ${className}`}
    >
      {header}
      <div
        className={`flex-1 min-h-0 overflow-y-auto ${flush ? '' : 'p-6 sm:p-7'} ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
