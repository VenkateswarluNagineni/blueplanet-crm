import { PipelineClient } from '@/components/pipeline/PipelineClient';
import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewAllPipeline } from '@/lib/rbac';
import { assertPageAccess } from '@/lib/page-access';
import { getOpportunities, getAssociateOptions, getQuotableSlabs } from '@/server/queries/pipeline';

export const metadata = { title: 'Sales Pipeline | BluePlanet' };

export default async function PipelinePage() {
  const ctx = assertPageAccess(await getSessionContext(), 'salesWorkspace');
  const settings = await getCompanySettings(ctx.user.companyId);

  // Sales reps see only their own pipeline unless granted global visibility.
  const seeAll = ctx.isAdmin || canViewAllPipeline(ctx.role, settings);
  const scope = seeAll ? null : ctx.associateSystemId;

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
