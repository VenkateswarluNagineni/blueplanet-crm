import { PipelineClient } from '@/components/PipelineClient';
import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewAllPipeline } from '@/lib/rbac';
import { getOpportunities, getAssociateOptions, getQuotableSlabs } from '@/server/queries/pipeline';

export const metadata = { title: 'Sales Pipeline | BluePlanet' };

export default async function PipelinePage() {
  const ctx = await getSessionContext();
  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;

  // Sales reps see only their own pipeline unless granted global visibility.
  const seeAll =
    (ctx?.isAdmin ?? false) || (settings && ctx ? canViewAllPipeline(ctx.role, settings) : false);
  const scope = seeAll ? null : ctx?.associateSystemId ?? null;

  const [opportunities, associates, quotableSlabs] = await Promise.all([
    getOpportunities(scope),
    getAssociateOptions(),
    getQuotableSlabs(),
  ]);

  return (
    <PipelineClient
      opportunities={opportunities}
      associates={associates}
      quotableSlabs={quotableSlabs}
    />
  );
}
