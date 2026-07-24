import { getSessionContext } from '@/lib/auth';
import { assertPageAccess } from '@/lib/page-access';
import { getStockMovements } from '@/server/queries/movements';
import { MovementsClient } from '@/components/MovementsClient';

export const metadata = { title: 'Stock Movements | BluePlanet' };

export default async function MovementsPage() {
  assertPageAccess(await getSessionContext(), 'admin');
  const movements = await getStockMovements();
  return <MovementsClient movements={movements} />;
}
