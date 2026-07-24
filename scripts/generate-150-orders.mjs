/**
 * Generate 150 full-lifecycle order combinations:
 *   PO (supplier + vendors) → receive slabs → sell → COMPLETED SO
 * Writes e2e/fixtures/order-matrix.json for Playwright.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'e2e', 'fixtures', 'order-matrix.json');
const TARGET = 150;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const round2 = (n) => Math.round(n * 100) / 100;
const ABBREV = { Marble: 'MBL', Quartzite: 'QZT', Granite: 'GRN', Travertine: 'TRV' };

async function nextPoNumber(tx) {
  const year = new Date().getFullYear();
  const latest = await tx.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: `PO-${year}-` } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  const seq = latest ? parseInt(latest.poNumber.split('-')[2], 10) : 0;
  return `PO-${year}-${String((Number.isNaN(seq) ? 0 : seq) + 1).padStart(3, '0')}`;
}

async function nextSoNumber(tx) {
  const latest = await tx.salesOrder.findFirst({
    where: { soNumber: { startsWith: 'SO-' } },
    orderBy: { soNumber: 'desc' },
    select: { soNumber: true },
  });
  const current = latest ? parseInt(latest.soNumber.replace('SO-', ''), 10) : 2000;
  return `SO-${(Number.isNaN(current) ? 2000 : current) + 1}`;
}

async function main() {
  console.log(`Generating ${TARGET} order lifecycle combinations…`);

  const products = await db.product.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  const locations = await db.location.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } });
  const customers = await db.party.findMany({
    where: { type: 'CUSTOMER', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });
  const associates = await db.party.findMany({
    where: { type: 'ASSOCIATE', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });
  const suppliers = await db.party.findMany({
    where: { type: 'SUPPLIER', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });
  const vendors = await db.party.findMany({
    where: { type: 'VENDOR', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });

  if (!products.length || !locations.length || !customers.length || !associates.length || !suppliers.length) {
    throw new Error('Seed data incomplete. Run: npm run db:seed');
  }

  const ocean = vendors.find((v) => /ocean/i.test(v.serviceType ?? '')) ?? vendors[0];
  const customs = vendors.find((v) => /customs/i.test(v.serviceType ?? '')) ?? vendors[1] ?? vendors[0];
  const inland = vendors.find((v) => /inland/i.test(v.serviceType ?? '')) ?? vendors[2] ?? vendors[0];

  // Price tiers ($/sf markup factors)
  const priceTiers = [1.5, 1.7, 1.85, 2.0, 2.25];
  // Role that "owns" the verification path in UI
  const roles = ['ADMIN', 'SALES'];

  const cases = [];
  let i = 0;
  // Build exactly TARGET combinations by cycling dimensions
  while (cases.length < TARGET) {
    const product = products[i % products.length];
    const location = locations[i % locations.length];
    const customer = customers[i % customers.length];
    const associate = associates[i % associates.length];
    const supplier = suppliers[i % suppliers.length];
    const priceTier = priceTiers[i % priceTiers.length];
    const role = roles[i % roles.length];
    const oceanCost = 3000 + (i % 5) * 250;
    const customsCost = 900 + (i % 4) * 100;
    const inlandCost = 600 + (i % 3) * 80;
    const unitCost = product.avgCostPerSf ?? 40 + (i % 20);

    cases.push({
      index: cases.length + 1,
      productId: product.id,
      productName: product.name,
      materialType: product.materialType,
      locationId: location.id,
      locationName: location.name,
      locationCode: location.code,
      customerId: customer.id,
      customerName: customer.name,
      customerSystemId: customer.systemId,
      associateId: associate.id,
      associateName: associate.name,
      associateSystemId: associate.systemId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierOrigin: supplier.originCountry ?? product.originCountry ?? 'Unknown',
      oceanVendorId: ocean?.id ?? null,
      oceanVendorName: ocean?.name ?? null,
      customsVendorId: customs?.id ?? null,
      customsVendorName: customs?.name ?? null,
      inlandVendorId: inland?.id ?? null,
      inlandVendorName: inland?.name ?? null,
      unitCost,
      oceanCost,
      customsCost,
      inlandCost,
      priceTier,
      verifyAsRole: role,
    });
    i += 1;
  }

  const maxBarcode = await db.inventoryItem.aggregate({ _max: { barcode: true } });
  let barcode = parseInt(maxBarcode._max.barcode ?? '2000000', 10);
  if (Number.isNaN(barcode)) barcode = 2000000;

  const results = [];
  const batchTag = `E2E150-${Date.now().toString(36).toUpperCase()}`;

  for (const c of cases) {
    const result = await db.$transaction(async (tx) => {
      const poNumber = await nextPoNumber(tx);
      const containerId = `${batchTag}-C${String(c.index).padStart(3, '0')}`;
      const eta = new Date();
      eta.setDate(eta.getDate() + 14 + (c.index % 20));

      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: c.supplierId,
          productId: c.productId,
          status: 'FULFILLED',
          logisticsStatus: 'RECEIVED',
          orderedSlabs: 1,
          unitCost: c.unitCost,
          oceanVendorId: c.oceanVendorId,
          customsVendorId: c.customsVendorId,
          inlandVendorId: c.inlandVendorId,
          oceanCost: c.oceanCost,
          customsCost: c.customsCost,
          inlandCost: c.inlandCost,
          destinationHub: c.locationName,
          eta: eta.toISOString().split('T')[0],
          estimatedDelivery: eta,
          containerId,
          receiptNumber: `GRN-${poNumber}`,
          ledgerHash: 'sha256:' + randomBytes(12).toString('hex'),
          issuedAt: new Date(),
          documentRefs: [`E2E-BOL-${c.index}`, `E2E-CUSTOMS-${c.index}`, `E2E-DO-${c.index}`],
        },
      });

      barcode += 1;
      const lengthInches = 110 + (c.index % 20);
      const widthInches = 60 + (c.index % 15);
      const totalSf = Math.round(((lengthInches * widthInches) / 144) * 10) / 10;
      const costFob = round2(totalSf * c.unitCost);
      const freight = c.oceanCost + c.customsCost + c.inlandCost;
      const costApportioned = round2(freight);
      const costLanded = round2(costFob + costApportioned);
      const abbrev = ABBREV[c.materialType] ?? 'GEN';
      const locShort = c.locationCode.replace('BP-', '');
      const yy = String(new Date().getFullYear()).slice(-2);
      const uniqueSlabId = `E2E-${locShort}-${yy}-${abbrev}-${String(c.index).padStart(4, '0')}`;

      const line = await tx.pOLineItem.create({
        data: { purchaseOrderId: po.id, expectedSf: totalSf, expectedCost: costLanded },
      });

      const slab = await tx.inventoryItem.create({
        data: {
          uniqueSlabId,
          barcode: String(barcode),
          productId: c.productId,
          presentLocationId: c.locationId,
          status: 'SOLD',
          lotNumber: containerId,
          lengthInches,
          widthInches,
          totalSf,
          costFob,
          costApportioned,
          costLanded,
          poLineItemId: line.id,
        },
      });

      const landedPerSf = totalSf > 0 ? costLanded / totalSf : c.unitCost;
      const pricePerSf = round2(Math.max((c.unitCost || 40) * c.priceTier, landedPerSf * c.priceTier, 80));
      const soNumber = await nextSoNumber(tx);

      await tx.salesOrder.create({
        data: {
          soNumber,
          customerName: `${c.customerName} — E2E #${c.index}`,
          customerId: c.customerId,
          associateId: c.associateId,
          status: 'COMPLETED',
          receiptRef: `WIRE-E2E-${c.index}`,
          placedAt: new Date(),
          soLineItems: {
            create: [
              {
                inventoryItemId: slab.id,
                soldPricePerSf: pricePerSf,
                landedCostAtSale: costLanded,
              },
            ],
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: slab.id,
          type: 'HOLD',
          fromStatus: 'AVAILABLE',
          toStatus: 'ON_HOLD',
          reason: `E2E sell #${c.index}`,
          byRole: 'SALES',
        },
      });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: slab.id,
          type: 'RELEASE',
          fromStatus: 'ON_HOLD',
          toStatus: 'SOLD',
          reason: `E2E complete ${soNumber}`,
          byRole: 'SALES',
        },
      });

      return {
        index: c.index,
        soNumber,
        uniqueSlabId,
        productName: c.productName,
        locationName: c.locationName,
        customerName: c.customerName,
        customerDisplay: `${c.customerName} — E2E #${c.index}`,
        associateName: c.associateName,
        supplierName: c.supplierName,
        supplierOrigin: c.supplierOrigin,
        poNumber,
        containerId,
        oceanVendorName: c.oceanVendorName,
        customsVendorName: c.customsVendorName,
        inlandVendorName: c.inlandVendorName,
        pricePerSf,
        totalSf,
        receiptRef: `WIRE-E2E-${c.index}`,
        verifyAsRole: c.verifyAsRole,
        batchTag,
      };
    });

    results.push(result);
    if (result.index % 25 === 0) console.log(`  … ${result.index}/${TARGET}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        batchTag,
        count: results.length,
        cases: results,
      },
      null,
      2,
    ),
  );

  console.log(`\nWrote ${results.length} cases → ${OUT}`);
  console.log(`Batch: ${batchTag}`);
  console.log(`Sample SO: ${results[0]?.soNumber}  slab: ${results[0]?.uniqueSlabId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
