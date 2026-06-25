import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';
import { Wordmark } from '@/components/brand/Wordmark';

export const metadata = {
  title: 'Sign in | BluePlanet CRM',
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/');

  return (
    <div className="h-screen w-full flex bg-[#2b2a2c]">
      {/* Signature: quarried-stone hero */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] vein border-r border-[#3a393b] p-12 relative overflow-hidden">
        <Wordmark size={30} />

        <div className="relative z-10 max-w-md">
          <p className="text-[12px] uppercase tracking-[0.2em] text-[#e3c16c] mb-5">Natural Stone · Inventory & CRM</p>
          <h2 className="text-white text-[40px] leading-[1.1] mb-5" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
            Every slab, from quarry to countertop.
          </h2>
          <p className="text-[14px] text-[#b8b6b9] leading-relaxed">
            Track landed cost, logistics, and the material passport of every slab — one source of truth for procurement, inventory, and sales.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-[12px] text-[#8a888c]">
          <span>Procurement</span>
          <span className="w-1 h-1 rounded-full bg-[#454446]" />
          <span>Inventory</span>
          <span className="w-1 h-1 rounded-full bg-[#454446]" />
          <span>Pipeline</span>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <LoginForm />
      </div>
    </div>
  );
}
