import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Inbound-parse webhook for the email-to-PO reconciliation engine.
 *
 * This route sits outside middleware.ts's cookie auth entirely (matcher
 * excludes /api/*), so it verifies itself via a shared secret rather than a
 * session. It normalizes whatever the chosen provider (SendGrid Inbound
 * Parse / Postmark Inbound / Mailgun Routes) sends into `InboundPayload`,
 * persists the raw message first (durability boundary — a crash after this
 * write never loses the source text), then runs deterministic PO matching.
 *
 * LLM-based delta extraction is intentionally NOT wired up here: no AI SDK
 * or API key exists in this project yet, and fabricating one isn't something
 * this change should do. `extractDeltasFromMessage` is the seam — swap its
 * body for a real structured-extraction call once a provider is chosen; the
 * schema (ReconciliationDelta) and review UI already support what it needs
 * to produce.
 */

type InboundPayload = {
  providerMessageId: string;
  from: string;
  to: string;
  subject?: string;
  text: string;
  html?: string;
  attachments?: { filename: string; contentType: string }[];
};

const PO_NUMBER_RE = /PO-\d{4}-\d{3}/i;

function parseInboxToken(toAddress: string): string | null {
  // Expected shape: po-recon+{token}@inbound.blueplanet.app
  const local = toAddress.split('@')[0] ?? '';
  const plusIdx = local.indexOf('+');
  return plusIdx === -1 ? null : local.slice(plusIdx + 1) || null;
}

async function matchPurchaseOrder(
  subject: string,
  bodyText: string,
  fromAddress: string,
): Promise<{ purchaseOrderId: string | null; matchMethod: string | null; matchConfidence: number | null }> {
  const poMatch = `${subject}\n${bodyText}`.match(PO_NUMBER_RE);
  if (poMatch) {
    const po = await db.purchaseOrder.findFirst({ where: { poNumber: { equals: poMatch[0], mode: 'insensitive' }, deletedAt: null } });
    if (po) return { purchaseOrderId: po.id, matchMethod: 'PO_NUMBER_IN_SUBJECT', matchConfidence: 0.95 };
  }

  const supplier = await db.party.findFirst({ where: { type: 'SUPPLIER', email: { equals: fromAddress, mode: 'insensitive' } } });
  if (supplier) {
    const openPos = await db.purchaseOrder.findMany({
      where: { supplierId: supplier.id, deletedAt: null, status: { not: 'FULFILLED' } },
      select: { id: true },
    });
    if (openPos.length === 1) {
      return { purchaseOrderId: openPos[0].id, matchMethod: 'SUPPLIER_EMAIL', matchConfidence: 0.6 };
    }
  }

  return { purchaseOrderId: null, matchMethod: null, matchConfidence: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function extractDeltasFromMessage(_messageId: string, _purchaseOrderId: string | null): Promise<void> {
  // Seam for real LLM structured-extraction. No-op until a provider/key is configured.
}

export async function POST(request: Request) {
  if (!env.RECONCILIATION_WEBHOOK_SECRET) {
    return new Response('Reconciliation webhook is not configured.', { status: 501 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${env.RECONCILIATION_WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }
  if (!payload.providerMessageId || !payload.from || !payload.to || !payload.text) {
    return new Response('Missing required fields.', { status: 400 });
  }

  const token = parseInboxToken(payload.to);
  if (!token) {
    return new Response('No reconciliation inbox token in recipient address; dropped.', { status: 202 });
  }
  const setting = await db.companySetting.findUnique({ where: { reconciliationInboxToken: token } });
  if (!setting) {
    // Deliberately not guessed — an unresolvable token means we don't know
    // which company's data this belongs to, so we drop it rather than attach
    // it to the wrong tenant.
    return new Response('Unrecognized reconciliation inbox token; dropped.', { status: 202 });
  }

  let message;
  try {
    message = await db.inboundMessage.create({
      data: {
        providerMessageId: payload.providerMessageId,
        fromAddress: payload.from,
        toAddress: payload.to,
        subject: payload.subject ?? null,
        bodyText: payload.text,
        bodyHtml: payload.html ?? null,
        rawPayload: payload as unknown as Prisma.InputJsonValue,
        attachments: (payload.attachments ?? null) as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Unique violation on providerMessageId = the provider retried a delivery
    // we already ingested. Acknowledge fast rather than reprocessing.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new Response('Already processed.', { status: 200 });
    }
    throw err;
  }

  const match = await matchPurchaseOrder(payload.subject ?? '', payload.text, payload.from);

  await db.reconciliationCase.create({
    data: {
      inboundMessageId: message.id,
      purchaseOrderId: match.purchaseOrderId,
      matchMethod: match.matchMethod,
      matchConfidence: match.matchConfidence,
      status: match.purchaseOrderId ? 'IN_REVIEW' : 'NEEDS_MATCH',
    },
  });

  await db.inboundMessage.update({ where: { id: message.id }, data: { status: 'EXTRACTED', processedAt: new Date() } });
  await extractDeltasFromMessage(message.id, match.purchaseOrderId);

  return new Response('OK', { status: 200 });
}
