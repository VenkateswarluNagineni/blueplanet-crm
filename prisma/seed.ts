import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const MATERIAL_ABBREV: Record<string, string> = {
  Marble: 'MBL',
  Quartzite: 'QZT',
  Granite: 'GRN',
  Travertine: 'TRV',
}

let barcodeCounter = 1000000

async function wipe() {
  // Delete in FK-safe order
  await prisma.sOLineItem.deleteMany()
  await prisma.salesOrder.deleteMany()
  await prisma.pOLineItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.opportunity.deleteMany()
  await prisma.vendorInvoice.deleteMany()
  await prisma.eventOutbox.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.product.deleteMany()
  await prisma.party.deleteMany()
  await prisma.userLocation.deleteMany()
  await prisma.user.deleteMany()
  await prisma.companySetting.deleteMany()
  await prisma.location.deleteMany()
  await prisma.company.deleteMany()
}

async function main() {
  console.log('Seeding BluePlanet CRM Database...')
  await wipe()

  // 1. Company + settings
  const company = await prisma.company.create({ data: { name: 'BluePlanet Inc.' } })
  await prisma.companySetting.create({ data: { companyId: company.id } })

  // 2. Locations
  const locNJ = await prisma.location.create({ data: { companyId: company.id, name: 'New Jersey HQ', code: 'BP-NJ' } })
  const locMD = await prisma.location.create({ data: { companyId: company.id, name: 'Maryland Hub', code: 'BP-MD' } })
  const locMA = await prisma.location.create({ data: { companyId: company.id, name: 'Boston HQ', code: 'BP-MA' } })

  // 3. Users (auth). Each login is linked to the Party it acts as further below.
  const users = [
    { email: 'admin@blueplanet.com', password: 'admin123', role: 'ADMIN' },
    { email: 'sales@blueplanet.com', password: 'sales123', role: 'SALES' },
    { email: 'vendor@blueplanet.com', password: 'vendor123', role: 'VENDOR' },
  ]
  const userByRole: Record<string, { id: string }> = {}
  for (const u of users) {
    const user = await prisma.user.create({
      data: { companyId: company.id, email: u.email, passwordHash: await bcrypt.hash(u.password, 10), role: u.role },
    })
    userByRole[u.role] = user
    await prisma.userLocation.create({ data: { userId: user.id, locationId: locNJ.id } })
  }
  // The sales login also covers the Maryland hub — so it sees catalog/inventory
  // across its home location (MD) plus New Jersey ("his location and another").
  await prisma.userLocation.create({ data: { userId: userByRole.SALES.id, locationId: locMD.id } })

  // 4. Parties — Suppliers
  const supAntolini = await prisma.party.create({
    data: { type: 'SUPPLIER', systemId: 'S-001', name: 'Antolini Italy', contactPerson: 'Marco Rossi', email: 'marco@antolini.it', phone: '+39 045 683 6611', originCountry: 'Italy', paymentTerms: 'Net 60', incoterms: 'FOB Genoa', creditLimit: 2000000, currency: 'EUR', totalPurchased: 1250000 },
  })
  const supCosentino = await prisma.party.create({
    data: { type: 'SUPPLIER', systemId: 'S-002', name: 'Cosentino Group', contactPerson: 'Lucia Gomez', email: 'lgomez@cosentino.com', phone: '+34 950 444 173', originCountry: 'Spain', paymentTerms: 'Net 30', incoterms: 'DDP Boston', creditLimit: 1500000, currency: 'USD', totalPurchased: 850000 },
  })
  const supCemex = await prisma.party.create({
    data: { type: 'SUPPLIER', systemId: 'S-003', name: 'Cemex Brazil', contactPerson: 'Joao Silva', email: 'jsilva@cemex.br', phone: '+55 11 9999-8888', originCountry: 'Brazil', paymentTerms: 'Pre-Pay', incoterms: 'CIF Miami', creditLimit: 0, currency: 'USD', totalPurchased: 320000 },
  })

  // Parties — Vendors (logistics)
  const venZim = await prisma.party.create({
    data: { type: 'VENDOR', systemId: 'V-001', name: 'ZIM Integrated Shipping', serviceType: 'Ocean Freight', contactPerson: 'Sarah Jenkins', email: 's.jenkins@zim.com', phone: '+1 800-555-0199', balanceDue: 20500 },
  })
  const venBalt = await prisma.party.create({
    data: { type: 'VENDOR', systemId: 'V-002', name: 'Baltimore Heavy Trucking', serviceType: 'Inland Logistics', contactPerson: 'Mike Peterson', email: 'dispatch@baltimoretruck.com', phone: '+1 410-555-0122', balanceDue: 6500 },
  })
  const venCustoms = await prisma.party.create({
    data: { type: 'VENDOR', systemId: 'V-003', name: 'Global Customs Brokerage', serviceType: 'Customs & Tariffs', contactPerson: 'Amanda Wei', email: 'awei@globalcustoms.com', phone: '+1 202-555-0188', balanceDue: 12000 },
  })

  // Parties — Associates (sales roster)
  const repJohn = await prisma.party.create({
    data: { type: 'ASSOCIATE', systemId: 'REP-1042', name: 'John Doe', role: 'Senior Sales Rep', baseLocation: 'Maryland Hub', commissionRate: '5%', salesTargetAnnual: 2000000, totalSold: 1200000 },
  })
  const repJane = await prisma.party.create({
    data: { type: 'ASSOCIATE', systemId: 'REP-1088', name: 'Jane Smith', role: 'Branch Manager', baseLocation: 'Boston HQ', commissionRate: '2% Override', salesTargetAnnual: 4000000, totalSold: 3100000 },
  })
  const repRobert = await prisma.party.create({
    data: { type: 'ASSOCIATE', systemId: 'REP-1102', name: 'Robert Chen', role: 'Sales Rep', baseLocation: 'New Jersey Hub', commissionRate: '5%', salesTargetAnnual: 800000, totalSold: 450000 },
  })

  // 3b. Link the demo logins to the Party they act AS, so attribution + scoping
  // are driven by identity (not a hardcoded rep id) everywhere downstream.
  await prisma.user.update({ where: { id: userByRole.SALES.id }, data: { partyId: repJohn.id } })
  await prisma.user.update({ where: { id: userByRole.VENDOR.id }, data: { partyId: venZim.id } })

  // Parties — Customers
  const custElite = await prisma.party.create({ data: { type: 'CUSTOMER', name: 'Elite Kitchens LLC', email: 'info@elitekitchens.com', totalSold: 85000 } })
  const custModern = await prisma.party.create({ data: { type: 'CUSTOMER', name: 'Modern Build LLC', email: 'ops@modernbuild.com', totalSold: 96250 } })
  const custLuxury = await prisma.party.create({ data: { type: 'CUSTOMER', name: 'Luxury Kitchens Inc.', email: 'buyers@luxurykitchens.com', totalSold: 45000 } })

  // 5. Products (catalog) with pricing + approved suppliers
  const products = [
    { sku: 'MBL-CAL-001', name: 'Calacatta Gold', materialType: 'Marble', finish: 'Polished', baseColor: 'White', thickness: '2cm', originCountry: 'Italy', retailPricePerSf: 125, minPricePerSf: 105, avgCostPerSf: 45, approvedSupplierIds: [supAntolini.id], yard: 12, location: locMD },
    { sku: 'QZT-TAJ-002', name: 'Taj Mahal', materialType: 'Quartzite', finish: 'Leathered', baseColor: 'Cream', thickness: '3cm', originCountry: 'Brazil', retailPricePerSf: 185, minPricePerSf: 155, avgCostPerSf: 75, approvedSupplierIds: [supCemex.id], yard: 5, hold: 1, location: locNJ },
    { sku: 'GRN-BLK-003', name: 'Absolute Black', materialType: 'Granite', finish: 'Honed', baseColor: 'Black', thickness: '3cm', originCountry: 'India', retailPricePerSf: 65, minPricePerSf: 50, avgCostPerSf: 22, approvedSupplierIds: [], yard: 18, location: locNJ },
    { sku: 'MBL-STA-004', name: 'Statuario', materialType: 'Marble', finish: 'Polished', baseColor: 'White', thickness: '2cm', originCountry: 'Italy', retailPricePerSf: 155, minPricePerSf: 130, avgCostPerSf: 65, approvedSupplierIds: [supAntolini.id], yard: 3, location: locMD },
    { sku: 'TRV-SIL-005', name: 'Silver Travertine', materialType: 'Travertine', finish: 'Unfilled', baseColor: 'Grey', thickness: '2cm', originCountry: 'Turkey', retailPricePerSf: 45, minPricePerSf: 35, avgCostPerSf: 15, approvedSupplierIds: [], yard: 14, location: locNJ },
  ]

  const productByName: Record<string, { id: string; avgCostPerSf: number }> = {}

  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        sku: p.sku, name: p.name, materialType: p.materialType, finish: p.finish, baseColor: p.baseColor,
        thickness: p.thickness, originCountry: p.originCountry, retailPricePerSf: p.retailPricePerSf,
        minPricePerSf: p.minPricePerSf, avgCostPerSf: p.avgCostPerSf, approvedSupplierIds: p.approvedSupplierIds,
      },
    })
    productByName[p.name] = { id: product.id, avgCostPerSf: p.avgCostPerSf }

    // Yard inventory (AVAILABLE)
    for (let i = 1; i <= (p.yard ?? 0); i++) {
      await createSlab(product.id, p.location.id, 'AVAILABLE', p.materialType, p.location.code, p.avgCostPerSf)
    }
    // On-hold inventory
    for (let i = 1; i <= (p.hold ?? 0); i++) {
      await createSlab(product.id, p.location.id, 'ON_HOLD', p.materialType, p.location.code, p.avgCostPerSf)
    }
  }

  // 6. Purchase Orders with logistics pipeline
  const poCalacatta = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-042', supplierId: supAntolini.id, productId: productByName['Calacatta Gold'].id,
      status: 'ISSUED', logisticsStatus: 'ON_WATER', orderedSlabs: 8, unitCost: 45,
      oceanVendorId: venZim.id, customsVendorId: venCustoms.id, inlandVendorId: venBalt.id,
      oceanCost: 9800, customsCost: 2400, inlandCost: 1600,
      containerId: 'ZIMU109248', eta: '2026-07-15', estimatedDelivery: new Date('2026-07-15'),
      destinationHub: 'Maryland Hub',
      documentRefs: ['INV-9921'], ledgerHash: 'sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      poLineItems: { create: [{ expectedSf: 8 * 63.5, expectedCost: 8 * 63.5 * 45 }] },
    },
  })
  await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-089', supplierId: supCemex.id, productId: productByName['Taj Mahal'].id,
      status: 'ISSUED', logisticsStatus: 'PRODUCTION', orderedSlabs: 14, unitCost: 75,
      oceanVendorId: 'SUPPLIER_COVERED', customsVendorId: venCustoms.id, inlandVendorId: venBalt.id,
      customsCost: 3100, inlandCost: 2200, // ocean is supplier-covered, so no ocean charge
      // Demo: an overdue PO — estimate has already passed while still in production.
      eta: '2026-06-20', estimatedDelivery: new Date('2026-06-20'), destinationHub: 'New Jersey Hub',
      ledgerHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      poLineItems: { create: [{ expectedSf: 14 * 63.5, expectedCost: 14 * 63.5 * 75 }] },
    },
  })
  void poCalacatta

  // A fully-received PO with per-slab line items — gives several slabs a complete,
  // real lineage (supplier → ocean → customs → inland → received → optionally sold).
  const poStatuario = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-001', supplierId: supAntolini.id, productId: productByName['Statuario'].id,
      status: 'FULFILLED', logisticsStatus: 'RECEIVED', orderedSlabs: 4, unitCost: 65,
      oceanVendorId: venZim.id, customsVendorId: venCustoms.id, inlandVendorId: venBalt.id,
      oceanCost: 2600, customsCost: 900, inlandCost: 600,
      containerId: 'MSCU7710421', eta: '2026-05-28', estimatedDelivery: new Date('2026-05-28'),
      receiptNumber: 'GRN-2026-0012', destinationHub: 'Maryland Hub',
      issuedAt: new Date('2026-04-10'),
      documentRefs: ['INV-8841', 'BOL-ZIM-5567', 'CUSTOMS-ENTRY-2291', 'GRN-2026-0012'],
      ledgerHash: 'sha256:1a2b3c4d5e6f70819293a4b5c6d7e8f90112233445566778899aabbccddeeff00',
    },
  })

  const statSlabs = []
  for (let i = 0; i < 4; i++) {
    statSlabs.push(
      await createSlabFromPO({
        productId: productByName['Statuario'].id,
        locationId: locMD.id,
        locCode: 'BP-MD',
        materialType: 'Marble',
        unitCost: 65,
        status: i === 0 ? 'SOLD' : 'AVAILABLE',
        purchaseOrderId: poStatuario.id,
        containerId: 'MSCU7710421',
      }),
    )
  }

  // 7. Opportunities (sales pipeline)
  const opps = [
    { name: 'Marriott Downtown Reno', associateId: repJohn.id, status: 'NEGOTIATION', amount: 250000, probability: 80, expectedCloseDate: new Date('2026-07-30') },
    { name: 'Luxury Kitchens Inc.', associateId: repJohn.id, customerId: custLuxury.id, status: 'QUOTED', amount: 200000, probability: 50, expectedCloseDate: new Date('2026-08-15') },
    { name: 'Boston Waterfront Condos', associateId: repJane.id, status: 'NEGOTIATION', amount: 850000, probability: 90, expectedCloseDate: new Date('2026-07-10') },
    { name: 'Smith Residential', associateId: repRobert.id, status: 'LEAD', amount: 45000, probability: 20, expectedCloseDate: new Date('2026-09-01') },
    { name: 'Oakwood Contracting', associateId: repRobert.id, status: 'QUOTED', amount: 75000, probability: 50, expectedCloseDate: new Date('2026-08-20') },
  ]
  for (const o of opps) {
    await prisma.opportunity.create({ data: { ...o, source: 'MANUAL' } })
  }

  // 8. Sales Orders (with a dedicated slab each)
  const calAvg = productByName['Calacatta Gold'].avgCostPerSf
  const tajAvg = productByName['Taj Mahal'].avgCostPerSf
  const slabSO1 = await createSlab(productByName['Calacatta Gold'].id, locMD.id, 'ON_HOLD', 'Marble', 'BP-MD', calAvg)
  const slabSO2 = await createSlab(productByName['Taj Mahal'].id, locNJ.id, 'SOLD', 'Quartzite', 'BP-NJ', tajAvg)

  await prisma.salesOrder.create({
    data: {
      soNumber: 'SO-1001', customerName: 'John Smith - Kitchen Remodel', associateId: repJohn.id, status: 'PLACED',
      placedAt: new Date('2026-06-23'),
      soLineItems: { create: [{ inventoryItemId: slabSO1.id, soldPricePerSf: 115, landedCostAtSale: slabSO1.costLanded ?? 0 }] },
    },
  })
  await prisma.salesOrder.create({
    data: {
      soNumber: 'SO-1002', customerName: 'Modern Build LLC', customerId: custModern.id, associateId: repJane.id, status: 'COMPLETED',
      placedAt: new Date('2026-06-15'), receiptRef: 'WIRE-771203',
      soLineItems: { create: [{ inventoryItemId: slabSO2.id, soldPricePerSf: 175, landedCostAtSale: slabSO2.costLanded ?? 0 }] },
    },
  })
  // Sell the first received Statuario slab — completes an end-to-end traceable chain
  // (Antolini → ZIM → Global Customs → Baltimore → Maryland Hub → Elite Kitchens).
  await prisma.salesOrder.create({
    data: {
      soNumber: 'SO-1003', customerName: 'Elite Kitchens LLC — Penthouse Vanity', customerId: custElite.id, associateId: repJohn.id, status: 'COMPLETED',
      placedAt: new Date('2026-06-18'), receiptRef: 'WIRE-889201',
      soLineItems: { create: [{ inventoryItemId: statSlabs[0].id, soldPricePerSf: 145, landedCostAtSale: statSlabs[0].costLanded ?? 0 }] },
    },
  })

  // 9. Vendor invoices (accounts payable)
  const invoices = [
    { invoiceNum: 'INV-ZIM-901', vendorId: venZim.id, status: 'Pending Payment', amount: 12500, dueDate: new Date('2026-07-01'), serviceDetails: 'Ocean Freight - Container ZIMU109248' },
    { invoiceNum: 'INV-ZIM-902', vendorId: venZim.id, status: 'Overdue', amount: 8000, dueDate: new Date('2026-06-15'), serviceDetails: 'Port Storage Fees' },
    { invoiceNum: 'INV-BALT-44', vendorId: venBalt.id, status: 'Pending Payment', amount: 6500, dueDate: new Date('2026-07-10'), serviceDetails: 'Inland Trucking (4 loads)' },
    { invoiceNum: 'INV-CUST-88', vendorId: venCustoms.id, status: 'In Dispute', amount: 12000, dueDate: new Date('2026-06-20'), serviceDetails: 'Tariff Assessment Adjustment' },
  ]
  for (const inv of invoices) await prisma.vendorInvoice.create({ data: inv })

  // 10. One pending approval in the outbox (measurement override demo)
  await prisma.eventOutbox.create({
    data: {
      eventType: 'MEASUREMENT_OVERRIDE', aggregateType: 'InventoryItem', aggregateId: slabSO1.uniqueSlabId,
      status: 'PENDING', payload: { lengthInches: 131, widthInches: 76, submittedBy: 'REP-1042', reason: 'Re-measured after polishing' },
    },
  })

  console.log('Database Seeded Successfully! 🚀')
}

/**
 * Create a slab that is linked to a real PurchaseOrder via its own POLineItem.
 * This gives the slab a complete inbound lineage (supplier, container/lot, costs)
 * that the Material Passport can trace back to.
 */
async function createSlabFromPO(opts: {
  productId: string
  locationId: string
  locCode: string
  materialType: string
  unitCost: number
  status: string
  purchaseOrderId: string
  containerId: string
}) {
  const lengthInches = 118 + Math.floor(Math.random() * 14)
  const widthInches = 65 + Math.floor(Math.random() * 13)
  const totalSf = Math.round(((lengthInches * widthInches) / 144) * 10) / 10
  const costFob = Math.round(totalSf * opts.unitCost * 100) / 100
  const costApportioned = Math.round(costFob * 0.28 * 100) / 100 // ocean + customs + inland, apportioned
  const costLanded = Math.round((costFob + costApportioned) * 100) / 100
  const abbrev = MATERIAL_ABBREV[opts.materialType] ?? 'GEN'
  const locShort = opts.locCode.replace('BP-', '')
  barcodeCounter += 1
  const line = await prisma.pOLineItem.create({
    data: { purchaseOrderId: opts.purchaseOrderId, expectedSf: totalSf, expectedCost: costLanded },
  })
  return prisma.inventoryItem.create({
    data: {
      uniqueSlabId: `BP-${locShort}-26-${abbrev}-${barcodeCounter}`,
      barcode: `${barcodeCounter}`,
      productId: opts.productId,
      presentLocationId: opts.locationId,
      status: opts.status,
      lotNumber: opts.containerId,
      lengthInches,
      widthInches,
      totalSf,
      costFob,
      costApportioned,
      costLanded,
      poLineItemId: line.id,
    },
  })
}

async function createSlab(
  productId: string,
  locationId: string,
  status: string,
  materialType: string,
  locCode: string,
  avgCostPerSf: number,
) {
  const lengthInches = 118 + Math.floor(Math.random() * 14) // 118..131
  const widthInches = 65 + Math.floor(Math.random() * 13) // 65..77
  const totalSf = Math.round(((lengthInches * widthInches) / 144) * 10) / 10
  const costLanded = Math.round(totalSf * avgCostPerSf * 100) / 100
  const costFob = Math.round(costLanded * 0.7 * 100) / 100
  const costApportioned = Math.round((costLanded - costFob) * 100) / 100
  const abbrev = MATERIAL_ABBREV[materialType] ?? 'GEN'
  const locShort = locCode.replace('BP-', '')
  barcodeCounter += 1
  return prisma.inventoryItem.create({
    data: {
      uniqueSlabId: `BP-${locShort}-26-${abbrev}-${barcodeCounter}`,
      barcode: `${barcodeCounter}`,
      productId,
      presentLocationId: locationId,
      status,
      lotNumber: `LOT-${9000 + (barcodeCounter % 1000)}`,
      lengthInches,
      widthInches,
      totalSf,
      costFob,
      costApportioned,
      costLanded,
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
