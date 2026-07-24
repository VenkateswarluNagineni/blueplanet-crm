import type { Page } from '@playwright/test';

export const CREDENTIALS = {
  ADMIN: { email: 'admin@blueplanet.com', password: 'admin123' },
  SALES: { email: 'sales@blueplanet.com', password: 'sales123' },
  VENDOR: { email: 'vendor@blueplanet.com', password: 'vendor123' },
} as const;

export type LoginRole = keyof typeof CREDENTIALS;

/** Sign in via the login form and wait until the app shell is visible. */
export async function loginAs(page: Page, role: LoginRole = 'ADMIN') {
  if (page.isClosed()) {
    throw new Error('loginAs: page is closed — recreate the page first');
  }
  const { email, password } = CREDENTIALS[role];
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (page.isClosed()) {
      throw new Error('loginAs: page closed mid-login');
    }
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25_000 });
      await page.waitForTimeout(300);
      return;
    } catch (err) {
      if (page.isClosed()) throw err;
      let offlineMsg = false;
      try {
        offlineMsg = (await page.getByText(/database is offline/i).count()) > 0;
      } catch {
        /* ignore */
      }
      if (attempt === maxAttempts) {
        throw new Error(
          `loginAs(${role}) failed after ${maxAttempts} attempts${offlineMsg ? ' (database offline)' : ''}`,
        );
      }
      await page.waitForTimeout(offlineMsg ? 2500 * attempt : 1000);
    }
  }
}

/**
 * Re-auth only when middleware bounced us to /login.
 * Does nothing if the page is closed — caller should recreate the page.
 */
export async function ensureAuthed(page: Page, role: LoginRole = 'ADMIN') {
  if (page.isClosed()) return;
  try {
    const path = new URL(page.url()).pathname;
    if (path.includes('/login')) {
      await loginAs(page, role);
    }
  } catch {
    if (!page.isClosed()) {
      await loginAs(page, role);
    }
  }
}
