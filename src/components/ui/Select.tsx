import React from 'react';

/**
 * Shared select — wraps .bp-select (globals.css) so every consumer gets
 * the same focus treatment instead of hand-rolling focus:outline-none/border-color.
 */
export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`bp-select ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}
