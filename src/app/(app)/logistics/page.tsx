import Link from 'next/link';
import { Package } from 'lucide-react';
import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getPurchaseOrders } from '@/server/purchasing/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { LogisticsTrackerClient } from '@/components/logistics/LogisticsTrackerClient';

export const metadata = { title: 'Logistics | BluePlanet' };

export default async function LogisticsPage() {
  assertPageAccess(await getSessionContext(), 'admin');

  const pos = await getPurchaseOrders();
  const inTransit = pos.filter((p) => p.status !== 'RECEIVED');

  return (
    <PageShell
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Supply', href: '/purchases' },
            { label: 'Logistics' },
          ]}
          title="Logistics"
          subtitle={`${inTransit.length} shipment${inTransit.length === 1 ? '' : 's'} currently in transit across the supply chain.`}
          meta={[
            { label: `${inTransit.length} in transit`, tone: inTransit.length > 0 ? 'gold' : 'green' },
            { label: `${pos.length} total POs`, tone: 'neutral' },
          ]}
          actions={
            <Link href="/purchases" className="btn-primary !min-h-8 !px-3 text-[12px]">
              <Package size={14} /> Purchasing
            </Link>
          }
        />
      }
    >
      <LogisticsTrackerClient
        pos={pos.map((p) => ({
          id: p.id,
          poNumber: p.poNumber,
          supplierName: p.supplierName,
          materialName: p.materialName,
          orderedSlabs: p.orderedSlabs,
          status: p.status,
          eta: p.eta,
          containerId: p.containerId,
        }))}
      />
    </PageShell>
  );
}
