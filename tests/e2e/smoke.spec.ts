import path from 'node:path';
import { expect, test } from '@playwright/test';

const DEMO_REPO_PATH = path.join(process.cwd(), 'tests/fixtures/demo-repo');

function uniqueEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerAndLandOnDashboard(page: import('@playwright/test').Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('e2e-test-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('unauthenticated visitors are redirected to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('register → add local repo → search → open result → a second user cannot see it', async ({
  page,
  browser,
}) => {
  await registerAndLandOnDashboard(page, uniqueEmail('owner'));
  await expect(page.getByText('No repositories yet')).toBeVisible();

  await page.getByRole('button', { name: 'Add repository' }).first().click();
  await page.getByRole('tab', { name: 'Local path' }).click();
  await page.getByLabel('Absolute path on this machine').fill(DEMO_REPO_PATH);
  await page.getByRole('button', { name: 'Add repository' }).last().click();

  await expect(page.getByText('demo-repo', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 20_000 });

  await page.goto('/search');
  await page.getByPlaceholder('Search across your repositories…').fill('authenticateUser');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const result = page.getByText('src/auth/authService.ts').first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await result.click();

  await expect(page).toHaveURL(/\/repos\/[^/?]+\?file=/);
  await expect(page.getByText('authenticateUser').first()).toBeVisible({ timeout: 10_000 });

  const repoUrl = new URL(page.url());
  const repoId = repoUrl.pathname.split('/').pop();

  // Fresh, isolated browser context — a second user with no shared cookies.
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await registerAndLandOnDashboard(otherPage, uniqueEmail('outsider'));
  await expect(otherPage.getByText('No repositories yet')).toBeVisible();

  await otherPage.goto(`/repos/${repoId}`);
  await expect(otherPage.getByText('Nothing found here')).toBeVisible();

  await otherContext.close();
});
