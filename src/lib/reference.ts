/**
 * Shared reference data for member intake — the canonical option lists that keep
 * collected information in a consistent, queryable format (no free-text where an
 * enum belongs). Imported by both the intake forms and the server-side validators.
 */

// A curated set of countries relevant to a global stone supply chain. Value is the
// display name; this list backs the country dropdowns for origin + addresses.
export const COUNTRIES = [
  'United States', 'Canada', 'Mexico', 'Brazil', 'Italy', 'Spain', 'Portugal',
  'Greece', 'Turkey', 'Egypt', 'India', 'China', 'Iran', 'Norway', 'Germany',
  'France', 'United Kingdom', 'Namibia', 'South Africa', 'Saudi Arabia', 'Oman',
  'United Arab Emirates', 'Vietnam', 'Indonesia', 'Australia', 'Argentina',
] as const;

export const CURRENCIES = ['USD', 'EUR', 'BRL', 'GBP', 'INR', 'TRY', 'CNY', 'CAD', 'AUD'] as const;

export const PAYMENT_TERMS = ['Pre-Pay', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'] as const;

export const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP', 'DPU'] as const;

export const PARTY_STATUS = ['ACTIVE', 'PREFERRED', 'ON_HOLD', 'INACTIVE'] as const;

export const SUPPLIER_SUBTYPES = ['Quarry', 'Fabricator', 'Distributor', 'Importer'] as const;

export const CUSTOMER_SUBTYPES = ['Fabricator', 'Designer', 'Contractor', 'Retail', 'Builder'] as const;

export const MATERIAL_CATEGORIES = ['Marble', 'Granite', 'Quartzite', 'Travertine', 'Onyx', 'Limestone', 'Soapstone'] as const;

export const VENDOR_SERVICE_TYPES = ['Ocean Freight', 'Inland Logistics', 'Customs & Tariffs', 'Warehousing', 'Multi-Service'] as const;

export const VENDOR_RATE_BASIS = ['Per Container', 'Per Mile', 'Per Shipment', 'Flat Rate', 'Percentage'] as const;

export const CUSTOMER_PRICE_TIERS = ['Standard', 'Preferred', 'Wholesale'] as const;

export const ASSOCIATE_ROLES = ['Sales Rep', 'Senior Sales Rep', 'Branch Manager', 'Regional Director'] as const;

export const ADDRESS_KINDS = ['PRIMARY', 'BILLING', 'SHIPPING', 'WAREHOUSE'] as const;

export const CONTACT_KINDS = ['GENERAL', 'SALES', 'AP', 'DISPATCH', 'LOGISTICS'] as const;

/** Login roles that can be provisioned when adding a member with portal access. */
export const LOGIN_ROLES = ['SALES', 'MANAGER', 'VENDOR'] as const;
