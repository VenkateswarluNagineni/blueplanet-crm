'use client';

import { useActionState, useState } from 'react';
import { loginAction, type LoginState } from './actions';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@blueplanet.com', password: 'admin123' },
  { label: 'Sales', email: 'sales@blueplanet.com', password: 'sales123' },
  { label: 'Vendor', email: 'vendor@blueplanet.com', password: 'vendor123' },
] as const;

/**
 * Auth form only — no decorative chrome.
 * E2E: #email, #password, button "Sign in"
 */
export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [email, setEmail] = useState('admin@blueplanet.com');
  const [password, setPassword] = useState('admin123');
  const [activeDemo, setActiveDemo] = useState(0);

  return (
    <div className="w-full">
      <header className="mb-8">
        <h1
          className="text-[1.75rem] text-white font-medium tracking-[-0.02em] leading-none"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Sign in
        </h1>
        <p className="mt-2.5 text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
          Use your workspace credentials to continue.
        </p>
      </header>

      <form action={action} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bp-login-input"
            placeholder="name@company.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bp-login-input"
          />
        </div>

        {state.error && (
          <div
            role="alert"
            className="rounded-[var(--radius-md)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-2.5 text-[12px] text-[var(--color-ruby)] leading-snug"
          >
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full !min-h-11 !text-[14px] !font-semibold mt-1"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {/* Demo picker — segmented control, not toy chips */}
      <div className="mt-8 pt-6 border-t border-[var(--color-basalt-500)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-fog-500)] mb-2.5">
          Demo accounts
        </p>
        <div
          className="grid grid-cols-3 rounded-[var(--radius-md)] border border-[var(--color-basalt-500)] p-0.5 bg-[var(--color-basalt-950)]"
          role="group"
          aria-label="Fill demo credentials"
        >
          {DEMO_ACCOUNTS.map((a, i) => {
            const on = activeDemo === i;
            return (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setActiveDemo(i);
                  setEmail(a.email);
                  setPassword(a.password);
                }}
                className={`h-9 rounded-[calc(var(--radius-md)-2px)] text-[12px] font-medium transition-colors ${
                  on
                    ? 'bg-[var(--color-basalt-700)] text-white shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-white'
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] text-[var(--color-fog-500)] text-center font-mono tabular-nums">
          {DEMO_ACCOUNTS[activeDemo].password}
        </p>
      </div>
    </div>
  );
}
