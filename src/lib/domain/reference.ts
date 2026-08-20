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

export const ASSOCIATE_ROLES = ['Sales Rep', 'Senior Sales Rep', 'Branch Manager', 'Regional Director', 'Installer', 'Templator'] as const;

/** Production stages an order moves through after being sold — buyer-checklist gap: no job tracking past "sold". */
export const PRODUCTION_STAGES = ['QUOTED', 'TEMPLATED', 'FABRICATED', 'INSTALLED'] as const;

export const ADDRESS_KINDS = ['PRIMARY', 'BILLING', 'SHIPPING', 'WAREHOUSE'] as const;

export const CONTACT_KINDS = ['GENERAL', 'SALES', 'AP', 'DISPATCH', 'LOGISTICS'] as const;

/** Login roles that can be provisioned when adding a member with portal access. */
export const LOGIN_ROLES = ['SALES', 'MANAGER', 'VENDOR'] as const;

// ---- Customer-intake reference lists (model the enterprise "New Customer" screen) ----

/** Why a customer is exempt from sales tax — keeps the exemption auditable. */
export const TAX_EXEMPT_REASONS = ['Resale', 'Government', 'Non-Profit', 'Manufacturing', 'Agricultural', 'Direct Pay', 'Other'] as const;

/** How finished documents (invoices, statements) are delivered to the customer. */
export const DOC_DELIVERY_METHODS = ['Email', 'Mail', 'Fax', 'Email & Mail', 'Customer Pickup'] as const;

/** Default way orders for this customer are fulfilled. */
export const FULFILLMENT_METHODS = ['Customer Pickup', 'Local Delivery', 'Freight / LTL', 'Will Call', 'Drop Ship'] as const;

// ---- Product-catalog hierarchy (model the enterprise "Products Master List") ----

/** Physical product form — the top-level discriminator in the master list. */
export const PRODUCT_TYPES = ['SLAB', 'SINK', 'TILE', 'PADS', 'A-FRAME'] as const;

/** Material/product categories used to pivot the catalog (broader than materialType). */
export const PRODUCT_CATEGORIES = [
  'GRANITE', 'MARBLE', 'QUARTZITE', 'QUARTZ', 'TRAVERTINE', 'ONYX', 'LIMESTONE',
  'SOAPSTONE', 'DOLOMITE', 'SINKS', 'CERAMIC', 'TILES', 'POLISHING PADS', 'PRINTED QUARTZ',
] as const;

/** Commercial grouping that drives positioning and price expectations. */
export const PRODUCT_GROUPS = ['Exotics', 'Premium', 'Semi-precious', 'Standard'] as const;

/** Physical kind of a company location/warehouse. */
export const LOCATION_TYPES = ['Warehouse', 'Showroom', 'Consignment', 'Office'] as const;

/** Login roles — single source of truth, mirrors the check already enforced in src/lib/domain/auth.ts. */
export const USER_ROLES = ['ADMIN', 'SALES', 'VENDOR'] as const;

/** Fabrication edge profiles offered at quote time — buyer-checklist item: "edge profiles configurable per shop, with associated upcharges." */
export const EDGE_PROFILES = ['Eased', 'Bullnose', 'Ogee', 'Bevel', 'Mitered', 'Waterfall'] as const;
