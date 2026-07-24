/**
 * 150 combinatorial lifecycle tests (one-by-one):
 * 1) Order appears in Sales Orders
 * 2) Slab opens Material Passport with supplier/PO lineage
 * 3) Passport shows origin → logistics → warehouse → customer + sales rep
 *
 * Prerequisites:
 *   docker start blueplanet-pg && npm run dev
 *   npm run e2e:generate
 *   npm run e2e
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loginAs } from './helpers/auth';

type Case = {
  index: number;
  soNumber: string;
  uniqueSlabId: string;
  productName: string;
  locationName: string;
  customerName: string;
  customerDisplay: string;
  associateName: string;
  supplierName: string;
  supplierOrigin: string;
  poNumber: string;
  containerId: string;
  oceanVendorName: string | null;
  customsVendorName: string | null;
  inlandVendorName: string | null;
  pricePerSf: number;
  receiptRef: string;
  verifyAsRole: 'ADMIN' | 'SALES';
};

const fixturePath = path.join(__dirname, 'fixtures', 'order-matrix.json');
const authDir = path.join(__dirname, '.auth');
const authFile = path.join(authDir, 'admin.json');

function loadCases(): Case[] {
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing ${fixturePath}. Run: npm run e2e:generate`);
  }
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    count: number;
    cases: Case[];
  };
  if (!raw.cases?.length) throw new Error('Fixture has zero cases');
  return raw.cases;
}

const cases = loadCases().slice(0, 150);

async function scrollPassportBody(page: Page) {
  await page.evaluate(() => {
    const panels = document.querySelectorAll('.overflow-y-auto');
    panels.forEach((d) => {
      (d as HTMLElement).scrollTop = (d as HTMLElement).scrollHeight;
    });
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('150 order lifecycle combinations (serial)', () => {
  test.beforeAll(() => {
    expect(cases.length).toBe(150);
  });

  /**
   * Fresh context per case (with saved auth) avoids long-lived shared page crashes
   * that abort the serial suite on Windows after ~50–100 cases.
   */
  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(authDir, { recursive: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'ADMIN');
    await context.storageState({ path: authFile });
    await context.close();
  });

  for (const c of cases) {
    test(`#${String(c.index).padStart(3, '0')} ${c.soNumber} · ${c.uniqueSlabId} · ${c.productName}`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);

      const context = await browser.newContext({ storageState: authFile });
      const page = await context.newPage();

      try {
        // ── 1) Order appears ──────────────────────────────────────────
        await page.goto('/orders', { waitUntil: 'domcontentloaded' });
        // Cookie expired / secret mismatch → re-login and refresh storage
        if (page.url().includes('/login')) {
          await loginAs(page, 'ADMIN');
          await context.storageState({ path: authFile });
          await page.goto('/orders', { waitUntil: 'domcontentloaded' });
        }

        await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({
          timeout: 20_000,
        });

        const search = page.getByPlaceholder(/search orders/i);
        await search.fill('');
        await search.fill(c.soNumber);
        await page.waitForTimeout(200);

        await expect(page.getByText(c.soNumber, { exact: true }).first()).toBeVisible({
          timeout: 20_000,
        });
        await expect(page.getByText(c.customerName, { exact: false }).first()).toBeVisible();
        await expect(page.getByText(c.uniqueSlabId, { exact: false }).first()).toBeVisible();
        await expect(page.getByText(/completed|sold/i).first()).toBeVisible();

        // ── 2) Inventory Material Passport ────────────────────────────
        const slabUrl = `/inventory?slab=${encodeURIComponent(c.uniqueSlabId)}`;
        await page.goto(slabUrl, { waitUntil: 'domcontentloaded' });
        if (page.url().includes('/login')) {
          await loginAs(page, 'ADMIN');
          await context.storageState({ path: authFile });
          await page.goto(slabUrl, { waitUntil: 'domcontentloaded' });
        }

        const passportTitle = page
          .getByTestId('passport-title')
          .or(page.getByRole('heading', { name: /material passport/i }));
        await expect(passportTitle).toBeVisible({ timeout: 25_000 });
        await expect(page.getByText(c.uniqueSlabId, { exact: false }).first()).toBeVisible();
        await expect(page.getByText(c.productName, { exact: false }).first()).toBeVisible();
        await expect(page.getByText(c.locationName, { exact: false }).first()).toBeVisible();

        // ── 3) Lineage: supplier / PO ─────────────────────────────────
        await expect(page.getByText(/1\.\s*supplier origin/i).first()).toBeVisible();
        await expect(page.getByText(c.supplierName, { exact: false }).first()).toBeVisible();
        await expect(page.getByText(c.poNumber, { exact: true }).first()).toBeVisible();

        await expect(page.getByText(/2\.\s*transit/i).first()).toBeVisible();
        if (c.oceanVendorName) {
          await expect(page.getByText(c.oceanVendorName, { exact: false }).first()).toBeVisible();
        }
        if (c.customsVendorName) {
          await expect(page.getByText(c.customsVendorName, { exact: false }).first()).toBeVisible();
        }
        if (c.inlandVendorName) {
          await expect(page.getByText(c.inlandVendorName, { exact: false }).first()).toBeVisible();
        }

        // Warehouse / current inventory
        await expect(page.getByText(/3\.\s*current inventory/i).first()).toBeVisible();

        // Sales / customer (sold slabs)
        await scrollPassportBody(page);
        await expect(page.getByText(/4\.\s*sales/i).first()).toBeVisible();
        await expect(page.getByText(c.customerName, { exact: false }).first()).toBeVisible();
        if (c.associateName) {
          await expect(page.getByText(c.associateName, { exact: false }).first()).toBeVisible();
        }
      } finally {
        await context.close();
      }
    });
  }
});
