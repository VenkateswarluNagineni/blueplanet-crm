import { Truck } from 'lucide-react';
import { getSessionContext } from '@/lib/auth';
import { assertPageAccess } from '@/lib/page-access';
import { getVendorPortal } from '@/server/queries/vendor';
import type { VendorKpis } from '@/components/VendorDashboard';
import { VendorPortalClient } from '@/components/VendorPortalClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = { title: 'Vendor Portal | BluePlanet' };

// Fallback for the demo admin who impersonates VENDOR without a linked party.
const FALLBACK_VENDOR_SYSTEM_ID = 'V-001';

export default async function VendorPortalPage() {
  const ctx = assertPageAccess(await getSessionContext(), 'vendorPortal');
  const vendorSystemId =
    ctx.party?.type === 'VENDOR' ? ctx.party.systemId ?? FALLBACK_VENDOR_SYSTEM_ID : FALLBACK_VENDOR_SYSTEM_ID;
  const portal = await getVendorPortal(vendorSystemId);

  if (!portal) {
    return (
      <PageShell
        header={
          <PageHeader
            eyebrow="Account"
            title="Vendor portal"
            subtitle="Linked logistics account required."
          />
        }
      >
        <EmptyState
          icon={Truck}
          title="No vendor account is linked to this login"
          hint="Ask an admin to attach a Vendor party to this user, or use View as: Vendor with a seeded demo account."
        />
      </PageShell>
    );
  }

  const kpis: VendorKpis = {
    balanceDue: portal.balanceDue,
    activeShipments: portal.orders.filter((o) => o.logisticsStatus !== 'RECEIVED').length,
    totalPos: portal.orders.length,
    openInvoices: portal.invoices.filter((i) => i.status !== 'Paid').length,
    overdueAmount: portal.invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0),
  };

  const active = kpis.activeShipments;

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow="Account"
          title={
            <span className="flex items-center gap-2">
              <Truck size={18} className="text-[#92b0ce]" /> {portal.vendorName}
            </span>
          }
          subtitle={
            <>
              {portal.serviceType} · Only your assigned legs and invoices
            </>
          }
          meta={[
            {
              label: `$${portal.balanceDue.toLocaleString()} balance`,
              tone: portal.balanceDue > 0 ? 'gold' : 'green',
            },
            { label: `${active} active shipment${active === 1 ? '' : 's'}`, tone: 'blue' },
            ...(kpis.overdueAmount > 0
              ? [{ label: `$${kpis.overdueAmount.toLocaleString()} overdue`, tone: 'gold' as const }]
              : []),
          ]}
        />
      }
    >
      <VendorPortalClient
        vendorName={portal.vendorName}
        serviceType={portal.serviceType}
        kpis={kpis}
        orders={portal.orders}
        invoices={portal.invoices}
        initialLayout={ctx.dashboardLayout ?? null}
      />
    </PageShell>
  );
}
