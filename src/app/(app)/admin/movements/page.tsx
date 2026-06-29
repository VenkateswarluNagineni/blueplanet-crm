import { redirect } from 'next/navigation';
import { getEffectiveRole } from '@/lib/auth';
import { getStockMovements } from '@/server/queries/movements';
import { MovementsClient } from '@/components/MovementsClient';

export const metadata = { title: 'Stock Movements | BluePlanet' };

export default async function MovementsPage() {
  const role = (await getEffectiveRole()) ?? 'SALES';
  if (role !== 'ADMIN') redirect('/');

  const movements = await getStockMovements();
  return <MovementsClient movements={movements} />;
}
