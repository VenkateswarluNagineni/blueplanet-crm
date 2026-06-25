import 'server-only';
import { db } from '@/lib/db';

export type OppItem = {
  id: string;
  name: string;
  customerLabel: string;
  associateName: string;
  amount: number;
  probability: number;
  status: string;
  expectedClose: string | null;
};

export const PIPELINE_STAGES = ['LEAD', 'QUOTED', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const;

export async function getOpportunities(scopeAssociateSystemId: string | null): Promise<OppItem[]> {
  const opps = await db.opportunity.findMany({
    where: {
      deletedAt: null,
      ...(scopeAssociateSystemId ? { associate: { systemId: scopeAssociateSystemId } } : {}),
    },
    include: {
      associate: { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: { amount: 'desc' },
  });

  return opps.map((o) => ({
    id: o.id,
    name: o.name,
    customerLabel: o.customer?.name ?? o.leadName ?? 'New Lead',
    associateName: o.associate?.name ?? 'Unassigned',
    amount: o.amount,
    probability: o.probability,
    status: o.status,
    expectedClose: o.expectedCloseDate ? o.expectedCloseDate.toISOString().split('T')[0] : null,
  }));
}

export async function getAssociateOptions(): Promise<{ id: string; name: string }[]> {
  return db.party.findMany({
    where: { type: 'ASSOCIATE', deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
