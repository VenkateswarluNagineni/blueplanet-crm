import { redirect } from 'next/navigation';
import { getCurrentUser, getEffectiveRole } from '@/lib/auth';
import { getCompanySettings } from '@/lib/rbac';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { SessionProvider } from '@/context/RoleContext';
import { ToastProvider } from '@/components/ui/Toast';
import { MobileNavProvider } from '@/context/MobileNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const role = ((await getEffectiveRole()) ?? 'SALES') as 'ADMIN' | 'SALES' | 'VENDOR';
  const settings = await getCompanySettings(user.companyId);

  return (
    <SessionProvider
      initialRole={role}
      initialSettings={settings}
      canImpersonate={user.role === 'ADMIN'}
      userEmail={user.email}
    >
      <ToastProvider>
        <MobileNavProvider>
          <div className="flex h-screen w-full">
            <Sidebar />
            <main className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
              <Header />
              <div className="flex-1 overflow-y-auto relative bg-[var(--color-background)]">
                {children}
              </div>
            </main>
          </div>
        </MobileNavProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
