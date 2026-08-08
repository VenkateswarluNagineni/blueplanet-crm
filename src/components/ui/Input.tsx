import React from 'react';

/**
 * Shared text input — wraps .bp-input (globals.css) so every consumer gets
 * the same focus ring instead of hand-rolling focus:outline-none/border-color.
 */
export function Input({
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`bp-input ${className}`.trim()} {...rest} />;
}
