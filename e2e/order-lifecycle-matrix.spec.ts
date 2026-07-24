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
import { test, expect, type Page, type Browser } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loginAs, ensureAuthed } from './helpers/auth';

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

  // Shared authenticated page for speed + full admin visibility.
  // Recreate if the browser crashes mid-suite (long serial runs on Windows).
  let browserRef: Browser;
  let page: Page;

  async function freshPage(): Promise<Page> {
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
    page = await browserRef.newPage();
    await loginAs(page, 'ADMIN');
    return page;
  }

  async function readyPage(): Promise<Page> {
    if (!page || page.isClosed()) {
      return freshPage();
    }
    return page;
  }

  test.beforeAll(async ({ browser }) => {
    browserRef = browser;
    await freshPage();
  });

  test.afterAll(async () => {
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
  });

  for (const c of cases) {
    test(`#${String(c.index).padStart(3, '0')} ${c.soNumber} · ${c.uniqueSlabId} · ${c.productName}`, async () => {
      test.setTimeout(120_000);

      // ── 0) Session guard (serial suite reuses one browser page) ───
      let p = await readyPage();
      try {
        await p.goto('/orders', { waitUntil: 'domcontentloaded' });
      } catch {
        p = await freshPage();
        await p.goto('/orders', { waitUntil: 'domcontentloaded' });
      }
      await ensureAuthed(p, 'ADMIN');
      if (p.isClosed()) {
        p = await freshPage();
        await p.goto('/orders', { waitUntil: 'domcontentloaded' });
      }
      if (!p.url().includes('/orders')) {
        await p.goto('/orders', { waitUntil: 'domcontentloaded' });
      }
      page = p;

      // ── 1) Order appears ──────────────────────────────────────────
      await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 20_000 });

      const search = page.getByPlaceholder(/search orders/i);
      await search.fill('');
      await search.fill(c.soNumber);
      // Allow filter to recompute
      await page.waitForTimeout(200);

      await expect(page.getByText(c.soNumber, { exact: true }).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(c.customerName, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(c.uniqueSlabId, { exact: false }).first()).toBeVisible();
      // Completed sale
      await expect(page.getByText(/completed|sold/i).first()).toBeVisible();

      // ── 2) Inventory Material Passport ────────────────────────────
      const slabUrl = `/inventory?slab=${encodeURIComponent(c.uniqueSlabId)}`;
      try {
        await page.goto(slabUrl, { waitUntil: 'domcontentloaded' });
      } catch {
        page = await freshPage();
        await page.goto(slabUrl, { waitUntil: 'domcontentloaded' });
      }
      await ensureAuthed(page, 'ADMIN');
      if (page.isClosed()) {
        page = await freshPage();
        await page.goto(slabUrl, { waitUntil: 'domcontentloaded' });
      }
      if (!page.url().includes('/inventory')) {
        await page.goto(slabUrl, { waitUntil: 'domcontentloaded' });
      }
      // Prefer testid (stable); fall back to heading role
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

      // Transit vendors
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

      // Warehouse
      await expect(page.getByText(/3\.\s*current inventory/i).first()).toBeVisible();

      // Sale node — scroll to bottom of passport
      await scrollPassportBody(page);
      await expect(page.getByText(/4\.\s*sales\s*&\s*customer/i).first()).toBeVisible();
      await expect(page.getByText(c.customerName, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(c.associateName, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(c.soNumber, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/sold/i).first()).toBeVisible();
    });
  }
});
