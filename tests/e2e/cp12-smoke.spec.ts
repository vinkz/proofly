import { test, expect, type Locator, type Page } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run the CP12 smoke test');

async function drawSignature(canvas: Locator, page: Page) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + 10;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 10, startY);
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.up();
}

test('CP12 wizard issues a PDF', async ({ page }) => {
  const loginEmail = email!;
  const loginPassword = password!;

  // Login
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(loginEmail);
  await page.getByPlaceholder('••••••••').fill(loginPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/($|dashboard|jobs)/, { timeout: 30_000 });

  // Start CP12 from the new job page
  await page.goto('/jobs/new');
  await page.getByRole('button', { name: /CP12/i }).click();
  await page.waitForURL(/wizard\/create\/cp12.*clientStep=1/, { timeout: 30_000 });

  // Add a fresh client to avoid collisions with seeded data
  await page.getByRole('combobox').selectOption('__add_client__');
  const timestamp = Date.now();
  await page.getByPlaceholder('Client name').fill(`Playwright Client ${timestamp}`);
  await page.getByPlaceholder('Company (optional)').fill('Playwright Co');
  await page.getByPlaceholder('client@example.com').fill(`pw-${timestamp}@example.com`);
  await page.getByPlaceholder('+44 7...').fill('07123456789');
  await page.getByPlaceholder('123 River St, Springfield').fill('1 Demo Street, London');
  await page.getByRole('button', { name: 'Create client' }).click();

  const continueBtn = page.getByRole('button', { name: 'Continue to Job Info' });
  await expect(continueBtn).toBeEnabled({ timeout: 20_000 });
  await continueBtn.click();

  await page.waitForURL(/wizard\/create\/cp12.*skipJobInfo=0/, { timeout: 30_000 });

  // Use the built-in demo filler to satisfy required CP12 fields quickly
  await page.getByTestId('cp12-demo-fill').first().click();
  await expect(page.getByRole('heading', { name: 'People & location' })).toBeVisible();
  const landlordName = page.getByTestId('cp12-landlord-name');
  await expect(landlordName).not.toHaveValue('');

  // Guard against empty job address fields
  const line1 = page.getByPlaceholder('Job address line 1');
  const postcode = page.getByPlaceholder('Postcode');
  if ((await line1.inputValue()).trim().length === 0) {
    await line1.fill('1 Demo Street');
  }
  if ((await postcode.inputValue()).trim().length === 0) {
    await postcode.fill('N1 1AA');
  }

  await page.getByTestId('cp12-step1-next').click();

  await expect(page.getByRole('heading', { name: 'Photo capture' })).toBeVisible();
  await page.getByRole('button', { name: 'Next → Checks' }).click();
  await page.getByRole('button', { name: 'Next → Sign' }).click();

  // Draw and save customer + engineer signatures
  const canvases = page.locator('canvas');
  await drawSignature(canvases.nth(0), page);
  await page.getByRole('button', { name: 'Save drawn signature' }).nth(0).click();
  await drawSignature(canvases.nth(1), page);
  await page.getByRole('button', { name: 'Save drawn signature' }).nth(1).click();

  // Generate PDF and confirm redirect to the job PDF view
  await page.getByTestId('cp12-issue').click();
  await page.waitForURL(/\/jobs\/[^/]+\/pdf/, { timeout: 120_000, waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/jobs\/[^/]+\/pdf/);
  await expect(page.getByText('Document Preview')).toBeVisible({ timeout: 15_000 });
});
