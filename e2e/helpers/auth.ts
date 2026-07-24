import type { Page } from '@playwright/test';

export const CREDENTIALS = {
  ADMIN: { email: 'admin@blueplanet.com', password: 'admin123' },
  SALES: { email: 'sales@blueplanet.com', password: 'sales123' },
  VENDOR: { email: 'vendor@blueplanet.com', password: 'vendor123' },
} as const;

export type LoginRole = keyof typeof CREDENTIALS;

/** Sign in via the login form and wait until the app shell is visible. */
export async function loginAs(page: Page, role: LoginRole = 'ADMIN') {
  const { email, password } = CREDENTIALS[role];
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
      await page.waitForTimeout(400);
      return;
    } catch (err) {
      if (page.isClosed()) throw err;
      let offlineMsg = false;
      try {
        offlineMsg = (await page.getByText(/database is offline/i).count()) > 0;
      } catch {
        /* page may have closed mid-check */
      }
      if (offlineMsg && attempt < maxAttempts) {
        await page.waitForTimeout(2000 * attempt);
        continue;
      }
      if (attempt === maxAttempts) {
        throw new Error(`loginAs(${role}) failed after ${maxAttempts} attempts`);
      }
      await page.waitForTimeout(1500);
    }
  }
}

/**
 * Re-auth only when middleware bounced us to /login.
 * Long serial suites can hit a brief DB blip; loginAs retries on offline.
 */
export async function ensureAuthed(page: Page, role: LoginRole = 'ADMIN') {
  try {
    const path = new URL(page.url()).pathname;
    if (path.includes('/login')) {
      await loginAs(page, role);
    }
  } catch {
    await loginAs(page, role);
  }
}
