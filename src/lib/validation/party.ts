/**
 * Single source of truth for member-intake validation. These zod schemas are used
 * by the server actions (authoritative) and mirror what the intake forms collect,
 * so every field is captured in a consistent, well-formed shape.
 */
import { z } from 'zod';
import {
  COUNTRIES, CURRENCIES, PAYMENT_TERMS, INCOTERMS, PARTY_STATUS, SUPPLIER_SUBTYPES,
  CUSTOMER_SUBTYPES, MATERIAL_CATEGORIES, VENDOR_SERVICE_TYPES, VENDOR_RATE_BASIS,
  CUSTOMER_PRICE_TIERS, ADDRESS_KINDS, CONTACT_KINDS, LOGIN_ROLES,
} from '@/lib/reference';

/** Normalize a phone number toward E.164-ish: keep a single leading +, digits only. */
export function normalizePhone(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  return (hasPlus ? '+' : '') + digits;
}

const optStr = z.string().trim().max(500).optional().or(z.literal(''));
const email = z.string().trim().toLowerCase().email('Enter a valid email address.').optional().or(z.literal(''));
const phone = z.string().trim().max(40).optional().or(z.literal(''));
const money = z.number().nonnegative('Must be zero or more.').optional();
const url = z.string().trim().url('Enter a valid URL (include https://).').optional().or(z.literal(''));

export const addressSchema = z.object({
  kind: z.enum(ADDRESS_KINDS).default('PRIMARY'),
  line1: z.string().trim().min(1, 'Street address is required.').max(200),
  line2: optStr,
  city: z.string().trim().min(1, 'City is required.').max(120),
  region: optStr,
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  country: z.enum(COUNTRIES),
});
export type AddressInput = z.input<typeof addressSchema>;

export const contactSchema = z.object({
  kind: z.enum(CONTACT_KINDS).default('GENERAL'),
  name: z.string().trim().min(1, 'Contact name is required.').max(160),
  title: optStr,
  email,
  phone,
});

// Fields shared by every member type.
const baseShape = {
  name: z.string().trim().min(1, 'Name is required.').max(200),
  legalName: optStr,
  website: url,
  status: z.enum(PARTY_STATUS).default('ACTIVE'),
  notes: optStr,
  contactPerson: optStr,
  email,
  phone,
  addresses: z.array(addressSchema).max(5).optional(),
  contacts: z.array(contactSchema).max(8).optional(),
};

// At least one way to reach the member: email OR phone OR a contact with either.
const reachable = (d: { email?: string; phone?: string; contacts?: { email?: string; phone?: string }[] }) =>
  !!(d.email || d.phone || d.contacts?.some((c) => c.email || c.phone));
const reachableMsg = { error: 'Provide at least one contact method (email or phone).', path: ['email'] };

export const supplierSchema = z.object({
  type: z.literal('SUPPLIER'),
  ...baseShape,
  subType: z.enum(SUPPLIER_SUBTYPES).optional(),
  originCountry: z.enum(COUNTRIES).optional(),
  materialCategories: z.array(z.enum(MATERIAL_CATEGORIES)).optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  incoterms: z.enum(INCOTERMS).optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  creditLimit: money,
  taxId: optStr,
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  minOrderValue: money,
  remittanceInfo: optStr,
  certifications: optStr,
}).refine(reachable, reachableMsg);

export const vendorSchema = z.object({
  type: z.literal('VENDOR'),
  ...baseShape,
  serviceType: z.enum(VENDOR_SERVICE_TYPES).optional(),
  serviceArea: optStr,
  rateBasis: z.enum(VENDOR_RATE_BASIS).optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  taxId: optStr,
  insurancePolicy: optStr,
  licenseNumber: optStr,
  provisionLogin: z.boolean().optional(),
  loginEmail: email,
  loginRole: z.enum(LOGIN_ROLES).optional(),
}).refine(reachable, reachableMsg);

export const customerSchema = z.object({
  type: z.literal('CUSTOMER'),
  ...baseShape,
  subType: z.enum(CUSTOMER_SUBTYPES).optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  creditLimit: money,
  taxId: optStr,
  taxExempt: z.boolean().optional(),
  resaleCertNumber: optStr,
  priceTier: z.enum(CUSTOMER_PRICE_TIERS).optional(),
  source: optStr,
  assignedAssociateId: optStr,
}).refine(reachable, reachableMsg);

export const associateSchema = z.object({
  type: z.literal('ASSOCIATE'),
  ...baseShape,
  role: optStr,
  baseLocation: optStr,
  territory: optStr,
  employeeId: optStr,
  startDate: z.string().trim().optional().or(z.literal('')),
  commissionRate: z.string().trim().max(8).optional().or(z.literal('')), // percent string e.g. "5%"
  salesTargetAnnual: money,
  provisionLogin: z.boolean().optional(),
  loginEmail: email,
  loginRole: z.enum(LOGIN_ROLES).optional(),
}).refine(reachable, reachableMsg);

export const createPartySchema = z.discriminatedUnion('type', [
  supplierSchema, vendorSchema, customerSchema, associateSchema,
]);
export type CreatePartyInput = z.input<typeof createPartySchema>;

// Commission is captured as a "5%" string for backward compatibility; validate the shape.
export function normalizeCommission(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) return undefined;
  return `${n}%`;
}
