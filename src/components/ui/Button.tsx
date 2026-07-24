import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger:
    'inline-flex items-center justify-center gap-1.5 min-h-9 px-4 text-[13px] font-medium rounded-[var(--radius-md)] bg-transparent text-[var(--color-ruby)] border border-[rgba(239,68,68,0.4)] hover:bg-[rgba(239,68,68,0.1)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
};

const SIZE: Record<Size, string> = {
  sm: '!min-h-8 !px-2.5 text-[12px]',
  md: '',
  lg: 'btn-lg',
};

/**
 * Shared button — DESIGN.md §4.2
 * Primary gold is scarce and decisive; secondary is structure; ghost is quiet.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={`${VARIANT[variant]} ${SIZE[size]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
