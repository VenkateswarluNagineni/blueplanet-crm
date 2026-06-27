'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole, getSessionContext } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { createPartySchema, normalizePhone, normalizeCommission, type CreatePartyInput } from '@/lib/validation/party';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreatePartyResult =
  | { ok: true; partyId: string; tempPassword?: string }
  | { ok: false; error: string };

type PartyType = 'SUPPLIER' | 'VENDOR' | 'CUSTOMER' | 'ASSOCIATE';

const PREFIX: Record<PartyType, string> = { SUPPLIER: 'S-', VENDOR: 'V-', CUSTOMER: 'C-', ASSOCIATE: 'REP-' };

/** Generate the next sequential systemId for a member type (S-001, REP-1101, …). */
async function nextSystemId(type: PartyType): Promise<string> {
  const prefix = PREFIX[type];
  const latest = await db.party.findFirst({
    where: { type, systemId: { startsWith: prefix } },
    orderBy: { systemId: 'desc' },
    select: { systemId: true },
  });
  const start = type === 'ASSOCIATE' ? 1100 : 0;
  const seq = latest?.systemId ? parseInt(latest.systemId.replace(prefix, ''), 10) : start;
  const next = (Number.isNaN(seq) ? start : seq) + 1;
  const width = type === 'ASSOCIATE' ? 0 : 3;
  return `${prefix}${width ? String(next).padStart(width, '0') : next}`;
}

/**
 * Provision a portal login for a newly created member (Associate/Vendor). Creates a
 * User with a generated temp password, links it to the Party, and — for sales roles —
 * assigns the matching location so role-scoped views work immediately. Returns the
 * one-time temp password to surface in the UI, or an error string.
 */
async function provisionLogin(opts: {
  companyId: string;
  partyId: string;
  email: string;
  role: string;
  baseLocation?: string | null;
}): Promise<{ tempPassword: string } | { error: string }> {
  const email = opts.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: `A login already exists for ${email}.` };

  const tempPassword = randomBytes(6).toString('base64url'); // ~8 chars, shown once
  const user = await db.user.create({
    data: {
      companyId: opts.companyId,
      email,
      passwordHash: await bcrypt.hash(tempPassword, 10),
      role: opts.role,
      partyId: opts.partyId,
    },
  });

  // Best-effort: assign the location whose name matches the member's base location.
  if (opts.baseLocation) {
    const loc = await db.location.findFirst({ where: { name: opts.baseLocation, deletedAt: null } });
    if (loc) await db.userLocation.create({ data: { userId: user.id, locationId: loc.id } });
  }
  return { tempPassword };
}

export async function createPartyAction(input: CreatePartyInput): Promise<CreatePartyResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const parsed = createPartySchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? 'Please complete the required fields in a valid format.' };
  }
  const d = parsed.data;

  // Guard against duplicate primary emails within the same member type.
  if (d.email) {
    const dupe = await db.party.findFirst({ where: { type: d.type, email: d.email, deletedAt: null }, select: { id: true } });
    if (dupe) return { ok: false, error: `A ${d.type.toLowerCase()} with that email already exists.` };
  }

  const systemId = await nextSystemId(d.type);

  // Type-specific column mapping — only the fields relevant to each member type.
  const supplierData = d.type === 'SUPPLIER' ? {
    subType: d.subType ?? null, originCountry: d.originCountry ?? null, materialCategories: d.materialCategories ?? [],
    paymentTerms: d.paymentTerms ?? null, incoterms: d.incoterms ?? null, currency: d.currency, creditLimit: d.creditLimit ?? 0,
    taxId: d.taxId || null, leadTimeDays: d.leadTimeDays ?? null, minOrderValue: d.minOrderValue ?? null,
    remittanceInfo: d.remittanceInfo || null, certifications: d.certifications || null,
  } : {};
  const vendorData = d.type === 'VENDOR' ? {
    serviceType: d.serviceType ?? null, serviceArea: d.serviceArea || null, rateBasis: d.rateBasis ?? null,
    currency: d.currency, paymentTerms: d.paymentTerms ?? null, taxId: d.taxId || null,
    insurancePolicy: d.insurancePolicy || null, licenseNumber: d.licenseNumber || null,
  } : {};
  const customerData = d.type === 'CUSTOMER' ? {
    subType: d.subType ?? null, currency: d.currency, paymentTerms: d.paymentTerms ?? null, creditLimit: d.creditLimit ?? 0,
    taxId: d.taxId || null, taxExempt: d.taxExempt ?? false, resaleCertNumber: d.resaleCertNumber || null,
    priceTier: d.priceTier ?? null, source: d.source || null, assignedAssociateId: d.assignedAssociateId || null,
  } : {};
  const associateData = d.type === 'ASSOCIATE' ? {
    role: d.role || null, baseLocation: d.baseLocation || null, territory: d.territory || null,
    employeeId: d.employeeId || null, startDate: d.startDate ? new Date(d.startDate) : null,
    commissionRate: normalizeCommission(d.commissionRate) ?? null, salesTargetAnnual: d.salesTargetAnnual ?? null,
  } : {};

  const party = await db.party.create({
    data: {
      type: d.type,
      systemId,
      name: d.name,
      legalName: d.legalName || null,
      website: d.website || null,
      status: d.status,
      notes: d.notes || null,
      contactPerson: d.contactPerson || null,
      email: d.email || null,
      phone: normalizePhone(d.phone) || null,
      ...supplierData,
      ...vendorData,
      ...customerData,
      ...associateData,
      addresses: d.addresses?.length
        ? { create: d.addresses.map((a, i) => ({
            kind: a.kind, line1: a.line1, line2: a.line2 || null, city: a.city,
            region: a.region || null, postalCode: a.postalCode || null, country: a.country,
            isPrimary: i === 0,
          })) }
        : undefined,
      contacts: d.contacts?.length
        ? { create: d.contacts.map((c) => ({
            kind: c.kind, name: c.name, title: c.title || null,
            email: c.email || null, phone: normalizePhone(c.phone) || null,
          })) }
        : undefined,
    },
  });

  // Optional portal login for Associate/Vendor.
  let tempPassword: string | undefined;
  const wantsLogin = (d.type === 'ASSOCIATE' || d.type === 'VENDOR') && d.provisionLogin;
  if (wantsLogin) {
    const loginEmail = d.loginEmail || d.email;
    if (!loginEmail) return { ok: false, error: 'A login email is required to provision portal access.' };
    const res = await provisionLogin({
      companyId: ctx.user.companyId,
      partyId: party.id,
      email: loginEmail,
      role: d.loginRole ?? (d.type === 'VENDOR' ? 'VENDOR' : 'SALES'),
      baseLocation: d.type === 'ASSOCIATE' ? d.baseLocation : null,
    });
    if ('error' in res) return { ok: false, error: res.error };
    tempPassword = res.tempPassword;
  }

  revalidatePath('/crm');
  return { ok: true, partyId: party.id, tempPassword };
}

const UpdateSchema = z.object({
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  // Supplier / Customer
  originCountry: z.string().optional(),
  paymentTerms: z.string().optional(),
  incoterms: z.string().optional(),
  creditLimit: z.number().optional(),
  taxId: z.string().optional(),
  leadTimeDays: z.number().optional(),
  // Vendor
  serviceType: z.string().optional(),
  serviceArea: z.string().optional(),
  rateBasis: z.string().optional(),
  insurancePolicy: z.string().optional(),
  licenseNumber: z.string().optional(),
  // Customer
  taxExempt: z.boolean().optional(),
  resaleCertNumber: z.string().optional(),
  priceTier: z.string().optional(),
  // Associate
  role: z.string().optional(),
  baseLocation: z.string().optional(),
  territory: z.string().optional(),
  commissionRate: z.string().optional(),
  salesTargetAnnual: z.number().optional(),
});

export async function updatePartyAction(
  id: string,
  type: PartyType,
  updates: z.input<typeof UpdateSchema>,
): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const existing = await db.party.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'Record not found.' };

  const parsed = UpdateSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: 'Invalid update.' };
  const u = parsed.data;

  await db.party.update({
    where: { id },
    data: {
      contactPerson: u.contactPerson,
      email: u.email,
      phone: normalizePhone(u.phone),
      website: u.website,
      status: u.status,
      notes: u.notes,
      ...(type === 'SUPPLIER'
        ? { originCountry: u.originCountry, paymentTerms: u.paymentTerms, incoterms: u.incoterms, creditLimit: u.creditLimit, taxId: u.taxId, leadTimeDays: u.leadTimeDays }
        : {}),
      ...(type === 'VENDOR'
        ? { serviceType: u.serviceType, serviceArea: u.serviceArea, rateBasis: u.rateBasis, insurancePolicy: u.insurancePolicy, licenseNumber: u.licenseNumber }
        : {}),
      ...(type === 'CUSTOMER'
        ? { paymentTerms: u.paymentTerms, creditLimit: u.creditLimit, taxId: u.taxId, taxExempt: u.taxExempt, resaleCertNumber: u.resaleCertNumber, priceTier: u.priceTier }
        : {}),
      ...(type === 'ASSOCIATE'
        ? { role: u.role, baseLocation: u.baseLocation, territory: u.territory, commissionRate: normalizeCommission(u.commissionRate), salesTargetAnnual: u.salesTargetAnnual }
        : {}),
    },
  });

  revalidatePath('/crm');
  return { ok: true };
}

/**
 * Set an associate's annual sales target. An admin may set any associate's target;
 * a sales rep may only set their own (the Party their login is linked to).
 */
export async function setSalesTargetAction(partyId: string, target: number): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  if (!Number.isFinite(target) || target < 0) return { ok: false, error: 'Enter a valid target amount.' };

  const isOwnTarget = ctx.party?.id === partyId && ctx.party?.type === 'ASSOCIATE';
  if (!ctx.isAdmin && !isOwnTarget) {
    return { ok: false, error: 'You can only edit your own target.' };
  }

  const existing = await db.party.findFirst({ where: { id: partyId, type: 'ASSOCIATE', deletedAt: null } });
  if (!existing) return { ok: false, error: 'Associate not found.' };

  await db.party.update({ where: { id: partyId }, data: { salesTargetAnnual: target } });
  revalidatePath('/crm');
  revalidatePath('/pipeline');
  return { ok: true };
}

export async function softDeletePartyAction(id: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const existing = await db.party.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'Record not found.' };

  await db.party.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/crm');
  return { ok: true };
}
