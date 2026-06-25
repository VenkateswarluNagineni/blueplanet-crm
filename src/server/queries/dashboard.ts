import 'server-only';
import { db } from '@/lib/db';

export type DashboardData = {
  kpis: {
    inventoryValue: number;
    availableSlabs: number;
    inTransitPos: number;
    openPipelineValue: number;
    ytdSales: number;
    pendingApprovals: number;
  };
  inventoryByLocation: { name: string; value: number }[];
  pipelineByStage: { name: string; value: number }[];
  poByStatus: { name: string; value: number }[];
  salesByAssociate: { name: string; value: number }[];
};

const PO_LABEL: Record<string, string> = {
  PRODUCTION: 'Production',
  ON_WATER: 'On Water',
  CUSTOMS: 'Customs',
  INLAND_TRANSIT: 'Inland',
  RECEIVED: 'Received',
};

export async function getDashboardData(canViewCost: boolean): Promise<DashboardData> {
  const [available, locations, pos, opps, completedSales, pendingApprovals] = await Promise.all([
    db.inventoryItem.findMany({
      where: { deletedAt: null, status: 'AVAILABLE' },
      select: { costLanded: true, presentLocationId: true },
    }),
    db.location.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    db.purchaseOrder.findMany({ where: { deletedAt: null }, select: { logisticsStatus: true } }),
    db.opportunity.findMany({
      where: { deletedAt: null, status: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } },
      select: { status: true, amount: true },
    }),
    db.salesOrder.findMany({
      where: { deletedAt: null, status: 'COMPLETED' },
      include: { associate: { select: { name: true } }, soLineItems: { include: { inventoryItem: { select: { totalSf: true } } } } },
    }),
    db.eventOutbox.count({ where: { status: 'PENDING' } }),
  ]);

  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const inventoryValue = available.reduce((s, i) => s + (i.costLanded ?? 0), 0);

  const byLoc = new Map<string, number>();
  for (const i of available) {
    const name = locName.get(i.presentLocationId) ?? 'Unknown';
    byLoc.set(name, (byLoc.get(name) ?? 0) + (i.costLanded ?? 0));
  }

  const byStage = new Map<string, number>();
  for (const o of opps) byStage.set(o.status, (byStage.get(o.status) ?? 0) + o.amount);

  const byPoStatus = new Map<string, number>();
  for (const p of pos) byPoStatus.set(p.logisticsStatus, (byPoStatus.get(p.logisticsStatus) ?? 0) + 1);

  const bySales = new Map<string, number>();
  let ytdSales = 0;
  for (const s of completedSales) {
    const val = s.soLineItems.reduce((sum, li) => sum + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0), 0);
    ytdSales += val;
    const name = s.associate?.name ?? 'Unassigned';
    bySales.set(name, (bySales.get(name) ?? 0) + val);
  }

  return {
    kpis: {
      inventoryValue: canViewCost ? Math.round(inventoryValue) : 0,
      availableSlabs: available.length,
      inTransitPos: pos.filter((p) => p.logisticsStatus !== 'RECEIVED').length,
      openPipelineValue: opps.reduce((s, o) => s + o.amount, 0),
      ytdSales: Math.round(ytdSales),
      pendingApprovals,
    },
    inventoryByLocation: canViewCost
      ? Array.from(byLoc, ([name, value]) => ({ name, value: Math.round(value) }))
      : [],
    pipelineByStage: Array.from(byStage, ([name, value]) => ({
      name: name.charAt(0) + name.slice(1).toLowerCase(),
      value: Math.round(value),
    })),
    poByStatus: Array.from(byPoStatus, ([name, value]) => ({ name: PO_LABEL[name] ?? name, value })),
    salesByAssociate: Array.from(bySales, ([name, value]) => ({ name, value: Math.round(value) })),
  };
}
