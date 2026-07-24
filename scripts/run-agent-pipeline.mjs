/**
 * BluePlanet multi-agent pipeline runner
 * --------------------------------------
 * 1. Ensures login agents exist for every operational role
 * 2. Assigns each agent to the correct Party (Associate / Vendor)
 * 3. Executes a full supply → sell transaction:
 *      ADMIN  → create PO → advance logistics → RECEIVED (slabs land)
 *      SALES  → create deal LEAD → QUOTED → NEGOTIATION → CLOSED_WON
 *             → convert to Sales Order → complete with receipt
 *      VENDOR → verify portal visibility of their logistics leg
 * 4. Prints credentials + audit trail
 *
 * Usage:  node scripts/run-agent-pipeline.mjs
 * Requires: Postgres up (docker start blueplanet-pg) and seed data present.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const log = (step, msg, extra) => {
  const prefix = `[${step}]`;
  console.log(`${prefix.padEnd(14)} ${msg}${extra != null ? `  ${JSON.stringify(extra)}` : ''}`);
};

const ADVANCE = {
  PRODUCTION: 'ON_WATER',
  ON_WATER: 'CUSTOMS',
  CUSTOMS: 'INLAND_TRANSIT',
  INLAND_TRANSIT: 'RECEIVED',
  RECEIVED: 'RECEIVED',
};

/** Upsert a user login and optionally bind to a party + locations. */
async function ensureAgent({
  companyId,
  email,
  password,
  role,
  partyId = null,
  locationIds = [],
}) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.user.findFirst({ where: { email, deletedAt: null } });
  let user;
  if (existing) {
    user = await db.user.update({
      where: { id: existing.id },
      data: { passwordHash, role, partyId, companyId },
    });
    log('AGENT', `Updated ${email} (${role})`);
  } else {
    user = await db.user.create({
      data: { companyId, email, passwordHash, role, partyId },
    });
    log('AGENT', `Created ${email} (${role})`);
  }

  // Locations: ensure at least the requested set
  for (const locationId of locationIds) {
    const link = await db.userLocation.findFirst({
      where: { userId: user.id, locationId },
    });
    if (!link) {
      await db.userLocation.create({ data: { userId: user.id, locationId } });
    }
  }
  return user;
}

async function nextPoNumber() {
  const year = new Date().getFullYear();
  const latest = await db.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: `PO-${year}-` } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  const seq = latest ? parseInt(latest.poNumber.split('-')[2], 10) : 0;
  const next = (Number.isNaN(seq) ? 0 : seq) + 1;
  return `PO-${year}-${String(next).padStart(3, '0')}`;
}

async function nextSoNumber() {
  const latest = await db.salesOrder.findFirst({
    where: { soNumber: { startsWith: 'SO-' } },
    orderBy: { soNumber: 'desc' },
    select: { soNumber: true },
  });
  const current = latest ? parseInt(latest.soNumber.replace('SO-', ''), 10) : 1000;
  return `SO-${(Number.isNaN(current) ? 1000 : current) + 1}`;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BluePlanet · Multi-Agent Role Assignment & Full Pipeline');
  console.log('═══════════════════════════════════════════════════════════\n');

  const company = await db.company.findFirst({ where: { deletedAt: null } });
  if (!company) {
    throw new Error('No company found. Run the seed first: npx tsx prisma/seed.ts');
  }

  const locations = await db.location.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });
  if (locations.length === 0) throw new Error('No locations — seed the database.');
  const locIds = locations.map((l) => l.id);
  const primaryLoc = locations[0];

  // ── Resolve parties (associates, vendors, suppliers, customers, products)
  const associates = await db.party.findMany({
    where: { type: 'ASSOCIATE', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });
  const vendors = await db.party.findMany({
    where: { type: 'VENDOR', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });
  const suppliers = await db.party.findMany({
    where: { type: 'SUPPLIER', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });
  const customers = await db.party.findMany({
    where: { type: 'CUSTOMER', deletedAt: null },
    orderBy: { systemId: 'asc' },
  });
  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  if (!associates.length || !vendors.length || !suppliers.length || !customers.length || !products.length) {
    throw new Error('Missing core parties/products. Re-seed: npx tsx prisma/seed.ts');
  }

  const repJohn = associates.find((a) => a.systemId === 'REP-1042') ?? associates[0];
  const repJane = associates.find((a) => a.systemId === 'REP-1088') ?? associates[1] ?? associates[0];
  const repRobert = associates.find((a) => a.systemId === 'REP-1102') ?? associates[2] ?? associates[0];

  const venOcean = vendors.find((v) => /ocean/i.test(v.serviceType ?? '') || v.systemId === 'V-001') ?? vendors[0];
  const venInland = vendors.find((v) => /inland/i.test(v.serviceType ?? '') || v.systemId === 'V-002') ?? vendors[1] ?? vendors[0];
  const venCustoms = vendors.find((v) => /customs/i.test(v.serviceType ?? '') || v.systemId === 'V-003') ?? vendors[2] ?? vendors[0];

  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — Create / assign agents for every role
  // ═══════════════════════════════════════════════════════════
  log('PHASE-1', 'Creating agents and assigning roles…');

  const agents = [];

  const admin = await ensureAgent({
    companyId: company.id,
    email: 'admin@blueplanet.com',
    password: 'admin123',
    role: 'ADMIN',
    locationIds: locIds,
  });
  agents.push({ email: 'admin@blueplanet.com', password: 'admin123', role: 'ADMIN', party: null, name: 'System Admin' });

  // Sales agents — one per associate
  const salesAgents = [
    { email: 'sales@blueplanet.com', password: 'sales123', party: repJohn, name: repJohn.name },
    { email: 'jane@blueplanet.com', password: 'jane123', party: repJane, name: repJane.name },
    { email: 'robert@blueplanet.com', password: 'robert123', party: repRobert, name: repRobert.name },
  ];
  for (const s of salesAgents) {
    await ensureAgent({
      companyId: company.id,
      email: s.email,
      password: s.password,
      role: 'SALES',
      partyId: s.party.id,
      locationIds: locIds.slice(0, 2),
    });
    // Ensure associate has email for CRM display
    await db.party.update({
      where: { id: s.party.id },
      data: { email: s.email },
    });
    agents.push({
      email: s.email,
      password: s.password,
      role: 'SALES',
      party: s.party.systemId,
      name: s.name,
    });
  }

  // Vendor agents — one per logistics vendor
  const vendorAgents = [
    { email: 'vendor@blueplanet.com', password: 'vendor123', party: venOcean, name: venOcean.name },
    { email: 'inland@blueplanet.com', password: 'inland123', party: venInland, name: venInland.name },
    { email: 'customs@blueplanet.com', password: 'customs123', party: venCustoms, name: venCustoms.name },
  ];
  for (const v of vendorAgents) {
    await ensureAgent({
      companyId: company.id,
      email: v.email,
      password: v.password,
      role: 'VENDOR',
      partyId: v.party.id,
      locationIds: [primaryLoc.id],
    });
    await db.party.update({
      where: { id: v.party.id },
      data: { email: v.email },
    });
    agents.push({
      email: v.email,
      password: v.password,
      role: 'VENDOR',
      party: v.party.systemId,
      name: v.name,
      service: v.party.serviceType,
    });
  }

  log('PHASE-1', `Agents ready: ${agents.length}`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — ADMIN: Procurement (PO → logistics → receive)
  // ═══════════════════════════════════════════════════════════
  log('PHASE-2', 'ADMIN procurement pipeline…');

  const supplier = suppliers[0];
  const product = products.find((p) => p.name.includes('Calacatta') || p.name.includes('Statuario')) ?? products[0];
  const orderedSlabs = 3;
  const unitCost = product.avgCostPerSf ?? 55;
  const poNumber = await nextPoNumber();
  const eta = new Date();
  eta.setDate(eta.getDate() + 28);

  const po = await db.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: supplier.id,
      productId: product.id,
      status: 'ISSUED',
      logisticsStatus: 'PRODUCTION',
      orderedSlabs,
      unitCost,
      oceanVendorId: venOcean.id,
      customsVendorId: venCustoms.id,
      inlandVendorId: venInland.id,
      oceanCost: 4200,
      customsCost: 1800,
      inlandCost: 950,
      destinationHub: primaryLoc.name,
      eta: eta.toISOString().split('T')[0],
      estimatedDelivery: eta,
      containerId: `BP-RUN-${Date.now().toString(36).toUpperCase()}`,
      ledgerHash: 'sha256:' + randomBytes(16).toString('hex'),
      issuedAt: new Date(),
      documentRefs: [`AGENT-PIPELINE-ISSUE-${poNumber}`],
    },
  });
  log('ADMIN', `Created PO ${po.poNumber}`, { product: product.name, slabs: orderedSlabs, supplier: supplier.name });

  // Advance through all legs (as ADMIN ops would)
  let current = 'PRODUCTION';
  const docs = {
    ON_WATER: `BOL-${poNumber}-OCEAN`,
    CUSTOMS: `CUSTOMS-REL-${poNumber}`,
    INLAND_TRANSIT: `DO-${poNumber}-INLAND`,
    RECEIVED: `GRN-${poNumber}`,
  };

  while (current !== 'RECEIVED') {
    const next = ADVANCE[current];
    const docRef = docs[next];
    const newDocs = [...po.documentRefs, docRef];

    if (next === 'RECEIVED') {
      // Materialize slabs into inventory (mirror advancePOAction)
      const materialAbbrev = { Marble: 'MBL', Quartzite: 'QZT', Granite: 'GRN', Travertine: 'TRV' };
      const abbrev = materialAbbrev[product.materialType] ?? 'GEN';
      const locShort = primaryLoc.code.replace('BP-', '');
      const yy = String(new Date().getFullYear()).slice(-2);
      const maxBarcode = await db.inventoryItem.aggregate({ _max: { barcode: true } });
      let counter = parseInt(maxBarcode._max.barcode ?? '1000000', 10);
      if (Number.isNaN(counter)) counter = 1000000;

      const round2 = (v) => Math.round(v * 100) / 100;
      const totalFreight = 4200 + 1800 + 950;
      const specs = Array.from({ length: orderedSlabs }).map((_, i) => {
        const n = counter + i + 1;
        const lengthInches = 118 + (n % 14);
        const widthInches = 65 + (n % 13);
        const totalSf = Math.round(((lengthInches * widthInches) / 144) * 10) / 10;
        return { n, lengthInches, widthInches, totalSf };
      });
      const sumSf = specs.reduce((s, x) => s + x.totalSf, 0) || 1;
      const receiptNumber = docs.RECEIVED;
      const createdIds = [];

      await db.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            logisticsStatus: 'RECEIVED',
            status: 'FULFILLED',
            documentRefs: newDocs,
            receiptNumber,
          },
        });

        for (const { n, lengthInches, widthInches, totalSf } of specs) {
          const costFob = round2(totalSf * unitCost);
          const costApportioned = round2(totalFreight * (totalSf / sumSf));
          const costLanded = round2(costFob + costApportioned);
          const uniqueSlabId = `BP-${locShort}-${yy}-${abbrev}-${n}`;
          createdIds.push(uniqueSlabId);
          const line = await tx.pOLineItem.create({
            data: { purchaseOrderId: po.id, expectedSf: totalSf, expectedCost: costLanded },
          });
          const item = await tx.inventoryItem.create({
            data: {
              uniqueSlabId,
              barcode: `${n}`,
              productId: product.id,
              presentLocationId: primaryLoc.id,
              status: 'AVAILABLE',
              lotNumber: po.containerId ?? po.poNumber,
              lengthInches,
              widthInches,
              totalSf,
              costFob,
              costApportioned,
              costLanded,
              poLineItemId: line.id,
            },
          });
          await tx.stockMovement.create({
            data: {
              inventoryItemId: item.id,
              type: 'TRANSFER',
              toLocationId: primaryLoc.id,
              fromStatus: 'ORDERED',
              toStatus: 'AVAILABLE',
              note: `Received on ${poNumber} via agent pipeline`,
              byUserId: admin.id,
              byRole: 'ADMIN',
            },
          });
        }

        await tx.party.update({
          where: { id: supplier.id },
          data: { totalPurchased: { increment: round2(sumSf * unitCost) } },
        });
      });

      log('ADMIN', `Received PO ${poNumber}`, { slabs: createdIds, location: primaryLoc.name });
      current = 'RECEIVED';
      po.documentRefs = newDocs;
    } else {
      await db.purchaseOrder.update({
        where: { id: po.id },
        data: { logisticsStatus: next, documentRefs: newDocs },
      });
      po.documentRefs = newDocs;
      log('ADMIN', `Advanced ${poNumber}: ${current} → ${next}`, { doc: docRef });
      current = next;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 3 — SALES: Full deal pipeline → SO → complete
  // ═══════════════════════════════════════════════════════════
  log('PHASE-3', 'SALES commercial pipeline…');

  const customer = customers.find((c) => c.systemId === 'C-001') ?? customers[0];
  const dealName = `Agent Pipeline · ${customer.name} · ${product.name}`;

  // Assign customer to John for scoped sales CRM
  await db.party.update({
    where: { id: customer.id },
    data: { assignedAssociateId: repJohn.id },
  });

  const opp = await db.opportunity.create({
    data: {
      name: dealName,
      leadName: customer.contactPerson ?? customer.name,
      amount: 185000,
      probability: 20,
      status: 'LEAD',
      source: 'AGENT_PIPELINE',
      associateId: repJohn.id,
      customerId: customer.id,
      expectedCloseDate: new Date(Date.now() + 21 * 86400000),
    },
  });
  log('SALES', `Created opportunity LEAD`, { id: opp.id, name: dealName, rep: repJohn.name });

  const stages = ['QUOTED', 'NEGOTIATION', 'CLOSED_WON'];
  let prob = 20;
  for (const status of stages) {
    prob = status === 'QUOTED' ? 45 : status === 'NEGOTIATION' ? 75 : 100;
    await db.opportunity.update({
      where: { id: opp.id },
      data: { status, probability: prob },
    });
    log('SALES', `Deal stage → ${status}`, { probability: prob });
  }

  // Pick an available slab for this product (from the PO we just received, or any)
  let slab = await db.inventoryItem.findFirst({
    where: {
      deletedAt: null,
      status: 'AVAILABLE',
      productId: product.id,
      presentLocationId: primaryLoc.id,
    },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!slab) {
    slab = await db.inventoryItem.findFirst({
      where: { deletedAt: null, status: 'AVAILABLE' },
      include: { product: true },
    });
  }
  if (!slab) throw new Error('No AVAILABLE slab to convert — inventory empty.');

  // costLanded is whole-slab; convert to per-sf for a realistic retail markup.
  const landedPerSf =
    slab.totalSf > 0 && slab.costLanded != null ? slab.costLanded / slab.totalSf : unitCost;
  const pricePerSf = Math.max(
    (slab.product.minPricePerSf ?? 0) + 5,
    Math.round(landedPerSf * 1.85 * 100) / 100,
    95,
  );

  const soNumber = await nextSoNumber();
  await db.$transaction([
    db.salesOrder.create({
      data: {
        soNumber,
        customerName: `${customer.name} — Agent Pipeline Job`,
        customerId: customer.id,
        associateId: repJohn.id,
        status: 'PLACED',
        soLineItems: {
          create: [
            {
              inventoryItemId: slab.id,
              soldPricePerSf: pricePerSf,
              landedCostAtSale: slab.costLanded ?? 0,
            },
          ],
        },
      },
    }),
    db.inventoryItem.update({
      where: { id: slab.id },
      data: { status: 'ON_HOLD', holdReason: `Pipeline convert ${opp.name}` },
    }),
    db.stockMovement.create({
      data: {
        inventoryItemId: slab.id,
        type: 'HOLD',
        fromStatus: 'AVAILABLE',
        toStatus: 'ON_HOLD',
        reason: `Converted opportunity ${dealName}`,
        byUserId: (await db.user.findFirst({ where: { email: 'sales@blueplanet.com' } }))?.id,
        byRole: 'SALES',
      },
    }),
  ]);
  log('SALES', `Converted CLOSED_WON → Sales Order ${soNumber}`, {
    slab: slab.uniqueSlabId,
    pricePerSf,
    customer: customer.name,
  });

  // Complete the order (payment received)
  const order = await db.salesOrder.findFirst({
    where: { soNumber },
    include: { soLineItems: true },
  });
  const receiptRef = `WIRE-AGENT-${Date.now().toString(36).toUpperCase()}`;
  await db.$transaction([
    db.salesOrder.update({
      where: { id: order.id },
      data: { status: 'COMPLETED', receiptRef },
    }),
    ...order.soLineItems.map((li) =>
      db.inventoryItem.update({
        where: { id: li.inventoryItemId },
        data: { status: 'SOLD', holdReason: null },
      }),
    ),
    ...order.soLineItems.map((li) =>
      db.stockMovement.create({
        data: {
          inventoryItemId: li.inventoryItemId,
          type: 'RELEASE',
          fromStatus: 'ON_HOLD',
          toStatus: 'SOLD',
          reason: `Sale completed ${soNumber} · ${receiptRef}`,
          byUserId: admin.id,
          byRole: 'SALES',
        },
      }),
    ),
  ]);
  // Bump customer lifetime + rep sold
  await db.party.update({
    where: { id: customer.id },
    data: { totalSold: { increment: pricePerSf * (slab.totalSf || 50) } },
  });
  await db.party.update({
    where: { id: repJohn.id },
    data: { totalSold: { increment: pricePerSf * (slab.totalSf || 50) } },
  });
  log('SALES', `Completed ${soNumber}`, { receiptRef, slab: slab.uniqueSlabId });

  // Secondary sales agent: open a lead for Jane (parallel book)
  const janeDeal = await db.opportunity.create({
    data: {
      name: `Agent Pipeline · Jane · ${product.name} Sample`,
      leadName: 'Walk-in Designer Studio',
      amount: 42000,
      probability: 30,
      status: 'LEAD',
      source: 'AGENT_PIPELINE',
      associateId: repJane.id,
      expectedCloseDate: new Date(Date.now() + 45 * 86400000),
    },
  });
  log('SALES', `Jane opened LEAD ${janeDeal.name}`, { id: janeDeal.id });

  // ═══════════════════════════════════════════════════════════
  // PHASE 4 — ADMIN: Approvals + vendor invoices for the PO
  // ═══════════════════════════════════════════════════════════
  log('PHASE-4', 'ADMIN ops + VENDOR AP…');

  await db.eventOutbox.create({
    data: {
      eventType: 'MEASUREMENT_OVERRIDE',
      aggregateType: 'InventoryItem',
      aggregateId: slab.uniqueSlabId,
      status: 'PENDING',
      payload: {
        lengthInches: slab.lengthInches,
        widthInches: slab.widthInches + 0.5,
        submittedBy: 'sales@blueplanet.com',
        reason: 'Agent pipeline re-measure demo',
      },
    },
  });
  log('ADMIN', 'Queued measurement approval for slab', { slab: slab.uniqueSlabId });

  // Vendor invoices for this PO’s legs (so each vendor portal has work)
  const invBase = `INV-AGENT-${Date.now().toString(36).toUpperCase()}`;
  await db.vendorInvoice.createMany({
    data: [
      {
        invoiceNum: `${invBase}-OCEAN`,
        vendorId: venOcean.id,
        status: 'Pending Payment',
        amount: 4200,
        dueDate: new Date(Date.now() + 14 * 86400000),
        serviceDetails: `Ocean freight · ${poNumber} · ${po.containerId}`,
      },
      {
        invoiceNum: `${invBase}-CUST`,
        vendorId: venCustoms.id,
        status: 'Pending Payment',
        amount: 1800,
        dueDate: new Date(Date.now() + 10 * 86400000),
        serviceDetails: `Customs clearance · ${poNumber}`,
      },
      {
        invoiceNum: `${invBase}-INLAND`,
        vendorId: venInland.id,
        status: 'Pending Payment',
        amount: 950,
        dueDate: new Date(Date.now() + 7 * 86400000),
        serviceDetails: `Inland delivery · ${poNumber} → ${primaryLoc.name}`,
      },
    ],
  });
  // Refresh vendor balances
  for (const [vid, amt] of [
    [venOcean.id, 4200],
    [venCustoms.id, 1800],
    [venInland.id, 950],
  ]) {
    await db.party.update({
      where: { id: vid },
      data: { balanceDue: { increment: amt } },
    });
  }
  log('VENDOR', 'Posted AP invoices for ocean / customs / inland legs');

  // Verify vendor portal scope for ocean carrier
  const zimOrders = await db.purchaseOrder.count({
    where: {
      deletedAt: null,
      OR: [
        { oceanVendorId: venOcean.id },
        { customsVendorId: venOcean.id },
        { inlandVendorId: venOcean.id },
      ],
    },
  });
  log('VENDOR', `ZIM portal can see ${zimOrders} assigned PO(s)`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 5 — Summary
  // ═══════════════════════════════════════════════════════════
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  AGENT ROSTER (login at http://localhost:3000/login)');
  console.log('───────────────────────────────────────────────────────────');
  console.log(
    '  ROLE     | EMAIL                      | PASSWORD    | ACTS AS',
  );
  console.log('  ---------|----------------------------|-------------|----------------');
  for (const a of agents) {
    const acts = a.party ? `${a.name} (${a.party})` : a.name;
    console.log(
      `  ${a.role.padEnd(8)} | ${a.email.padEnd(26)} | ${a.password.padEnd(11)} | ${acts}`,
    );
  }

  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  PIPELINE TRANSACTION COMPLETED');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  PO          ${poNumber}`);
  console.log(`  Product     ${product.name}`);
  console.log(`  Slabs recv  ${orderedSlabs} @ ${primaryLoc.name}`);
  console.log(`  Deal        ${dealName}`);
  console.log(`  Stages      LEAD → QUOTED → NEGOTIATION → CLOSED_WON`);
  console.log(`  Sales Order ${soNumber}  COMPLETED  receipt ${receiptRef}`);
  console.log(`  Slab sold   ${slab.uniqueSlabId} @ $${pricePerSf}/sf`);
  console.log(`  Customer    ${customer.name} (${customer.systemId})`);
  console.log(`  Sales rep   ${repJohn.name} (${repJohn.systemId})`);
  console.log(`  Vendors     ${venOcean.name} / ${venCustoms.name} / ${venInland.name}`);
  console.log('\n  Verify in UI:');
  console.log('    ADMIN  → Purchasing, Logistics, Approvals, Analytics, Movements');
  console.log('    SALES  → Pipeline (won deal), Orders (completed SO), Customers');
  console.log('    VENDOR → Portal shipments + new invoices');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('\nPIPELINE FAILED:', e.message);
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
