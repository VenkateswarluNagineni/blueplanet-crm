import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getStockMovements } from '@/server/movements/queries';
import { MovementsClient } from '@/components/movements/MovementsClient';

export const metadata = { title: 'Stock Movements | BluePlanet' };

export default async function MovementsPage() {
  assertPageAccess(await getSessionContext(), 'admin');
  const movements = await getStockMovements();
  return <MovementsClient movements={movements} />;
}
