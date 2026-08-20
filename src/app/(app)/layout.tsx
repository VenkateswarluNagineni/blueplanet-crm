import { redirect } from 'next/navigation';
import { getCurrentUser, getEffectiveRole } from '@/lib/domain/auth';
import { getCompanySettings } from '@/lib/domain/rbac';
import { db } from '@/lib/db';
import { getOpenReconciliationCount } from '@/server/reconciliation/queries';
import { Sidebar } from '@/components/shell/Sidebar';
import { Header } from '@/components/shell/Header';
import { SessionProvider } from '@/context/RoleContext';
import { ToastProvider } from '@/components/ui/Toast';
import { MobileNavProvider } from '@/context/MobileNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const role = ((await getEffectiveRole()) ?? 'SALES') as 'ADMIN' | 'SALES' | 'VENDOR';
  const settings = await getCompanySettings(user.companyId);

  // Lightweight badges for Approvals / Reconciliation nav entries (admin only).
  const pendingApprovals =
    role === 'ADMIN' ? await db.eventOutbox.count({ where: { status: 'PENDING' } }) : 0;
  const openReconciliationCases = role === 'ADMIN' ? await getOpenReconciliationCount() : 0;
  const productionIssues =
    role === 'ADMIN' || role === 'SALES'
      ? await db.salesOrder.count({ where: { blockerNote: { not: null }, deletedAt: null } })
      : 0;

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
            <Sidebar
              badges={{
                approvals: pendingApprovals,
                reconciliation: openReconciliationCases,
                productionIssues,
              }}
            />
            <main className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
              <Header />
              <div className="flex-1 overflow-y-auto relative bg-[var(--color-basalt-850)]">
                {children}
              </div>
            </main>
          </div>
        </MobileNavProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
