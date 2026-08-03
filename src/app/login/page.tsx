import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/domain/auth';
import { LoginForm } from './LoginForm';
import { Wordmark } from '@/components/brand/Wordmark';

export const metadata = {
  title: 'Sign in | BluePlanet CRM',
};

export const dynamic = 'force-dynamic';

/**
 * Institutional login — frontend-ux-engineer:
 * usable auth workflow, not a decorative landing page.
 * Optical: 50/50, three-zone hero (brand / thesis / footer), form optically centered.
 */
export default async function LoginPage() {
  let user = null as Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('Dynamic server usage') && !msg.includes('DYNAMIC_SERVER_USAGE')) {
      console.error('[login page] session lookup failed', err);
    }
  }
  if (user) redirect('/');

  return (
    <div className="h-dvh w-full grid lg:grid-cols-2 bg-[var(--color-basalt-950)] overflow-hidden">
      {/* ── Brand column ───────────────────────────────────── */}
      <aside
        className="relative hidden lg:flex flex-col h-dvh border-r border-[var(--color-basalt-500)]"
        style={{
          backgroundColor: '#141315',
          backgroundImage: `
            radial-gradient(90% 70% at 0% 0%, rgba(227,193,108,0.09), transparent 55%),
            radial-gradient(70% 50% at 100% 100%, rgba(146,176,206,0.06), transparent 50%)
          `,
        }}
      >
        <div className="flex flex-col h-full px-14 xl:px-[4.5rem] py-12">
          {/* Zone 1 — brand */}
          <div className="shrink-0">
            <Wordmark size={30} />
          </div>

          {/* Zone 2 — thesis (true vertical center of remaining space) */}
          <div className="flex-1 flex flex-col justify-center min-h-0 py-10">
            <div className="max-w-[26rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-vein)] mb-6">
                Natural stone · Inventory &amp; CRM
              </p>
              <h1
                className="text-[2.375rem] xl:text-[2.625rem] text-white font-medium tracking-[-0.02em] leading-[1.12] mb-5"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Every slab, from quarry to countertop.
              </h1>
              <p className="text-[14px] text-[var(--color-text-secondary)] leading-[1.65] max-w-[34ch]">
                Procurement, logistics, yard stock, and sales — one ledger, with a material passport
                on every slab.
              </p>

              {/* Quiet capability row — not AI feature cards */}
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[var(--color-fog-500)]">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[var(--color-vein)] shrink-0" />
                  Landed cost
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[var(--color-sodalite)] shrink-0" />
                  Material passport
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[var(--color-emerald)] shrink-0" />
                  Deal → order
                </li>
              </ul>
            </div>
          </div>

          {/* Zone 3 — footer */}
          <p className="shrink-0 text-[12px] text-[var(--color-fog-500)] tracking-wide">
            BluePlanet · Stone operations
          </p>
        </div>
      </aside>

      {/* ── Auth column ────────────────────────────────────── */}
      <main className="h-dvh flex flex-col bg-[var(--color-basalt-900)] border-l border-[var(--color-basalt-500)] lg:border-l-0">
        {/* Mobile brand */}
        <div className="lg:hidden shrink-0 px-6 pt-8 pb-2">
          <Wordmark size={28} />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-8">
          <div className="w-full max-w-[22.5rem]">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
