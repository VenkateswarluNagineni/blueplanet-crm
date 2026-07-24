import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export type Breadcrumb = {
  label: string;
  href?: string;
};

export type MetaChip = {
  label: string;
  tone?: 'neutral' | 'gold' | 'green' | 'blue';
};

const CHIP_TONE: Record<NonNullable<MetaChip['tone']>, string> = {
  neutral: 'bg-[var(--color-basalt-800)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
  gold: 'bg-[rgba(227,193,108,0.12)] text-[var(--color-vein)] border-[rgba(227,193,108,0.3)]',
  green: 'bg-[rgba(16,185,129,0.1)] text-[var(--color-emerald)] border-[rgba(16,185,129,0.3)]',
  blue: 'bg-[rgba(146,176,206,0.12)] text-[var(--color-sodalite)] border-[rgba(146,176,206,0.3)]',
};

/**
 * Award-grade page chrome: orientation, title, meta chips, actions, toolbar row.
 * Spec: DESIGN.md §3.2
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumbs,
  meta,
  actions,
  children,
  className = '',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  breadcrumbs?: Breadcrumb[];
  meta?: MetaChip[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const hasTrail = (breadcrumbs && breadcrumbs.length > 0) || !!eyebrow;

  return (
    <div className={`bp-header-chrome pt-5 pb-4 px-6 shrink-0 ${className}`}>
      {hasTrail && (
        <div className="flex items-center gap-2 flex-wrap mb-2.5 min-h-[18px]">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 flex-wrap text-[11px]">
              {breadcrumbs.map((crumb, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.label}-${i}`}>
                    {i > 0 && (
                      <ChevronRight size={12} className="text-[var(--color-fog-500)] shrink-0" aria-hidden />
                    )}
                    {crumb.href && !last ? (
                      <Link
                        href={crumb.href}
                        className="text-[var(--color-sodalite)] hover:text-white transition-colors truncate max-w-[140px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className={`truncate max-w-[180px] ${last ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-fog-500)]'}`}
                        aria-current={last ? 'page' : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          ) : eyebrow ? (
            <p className="bp-eyebrow">{eyebrow}</p>
          ) : null}
        </div>
      )}

      <div className={`flex items-end justify-between gap-4 ${children ? 'mb-4' : ''}`}>
        <div className="min-w-0">
          <h1 className="text-[22px] font-medium text-white mb-1.5 truncate tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
          {meta && meta.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              {meta.map((chip) => (
                <span
                  key={chip.label}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${CHIP_TONE[chip.tone ?? 'neutral']}`}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
