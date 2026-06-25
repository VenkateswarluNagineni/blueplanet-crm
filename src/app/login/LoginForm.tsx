'use client';

import { useActionState, useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { loginAction, type LoginState } from './actions';
import { Wordmark } from '@/components/brand/Wordmark';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@blueplanet.com', password: 'admin123' },
  { label: 'Sales', email: 'sales@blueplanet.com', password: 'sales123' },
  { label: 'Vendor', email: 'vendor@blueplanet.com', password: 'vendor123' },
];

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [email, setEmail] = useState('admin@blueplanet.com');
  const [password, setPassword] = useState('admin123');

  return (
    <div className="w-full max-w-sm">
      <div className="mb-10 lg:hidden">
        <Wordmark size={28} />
      </div>

      <h1 className="text-[28px] text-white mb-1.5">Sign in</h1>
      <p className="text-[13px] text-[#b8b6b9] mb-7">Welcome back. Sign in to your workspace.</p>

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[12px] text-[#b8b6b9] mb-1.5">Email</label>
          <div className="flex items-center bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-2.5 focus-within:border-[#92b0ce] transition-colors">
            <Mail size={14} className="text-[#b8b6b9] mr-2" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] text-white w-full"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-[12px] text-[#b8b6b9] mb-1.5">Password</label>
          <div className="flex items-center bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-2.5 focus-within:border-[#92b0ce] transition-colors">
            <Lock size={14} className="text-[#b8b6b9] mr-2" />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] text-white w-full"
            />
          </div>
        </div>

        {state.error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-[#e3c16c] text-[#1a1a1a] font-medium text-[13px] rounded-md py-2.5 hover:bg-[#d2ac55] transition-colors disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-[#454446]">
        <p className="text-[11px] uppercase tracking-wider text-[#b8b6b9] mb-3">Demo accounts — tap to fill</p>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              type="button"
              key={a.email}
              onClick={() => { setEmail(a.email); setPassword(a.password); }}
              className="bg-[#1c1c1c] border border-[#454446] rounded p-2 text-left hover:border-[#e3c16c] transition-colors"
            >
              <p className="text-white font-medium">{a.label}</p>
              <p className="text-[#92b0ce] mt-0.5">{a.password}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
