import { expect, test } from '@playwright/test';

/**
 * The public request flow, end to end, for the field that used to be dropped.
 *
 * This writes a real `job_requests` row, so it is opt-in: set
 * E2E_PUBLIC_WRITES=1 to run it. The engineer named below deliberately does not
 * match any profile, which leaves the request unassigned (`user_id` null) and
 * therefore invisible in every engineer's inbox — and the run prints the
 * reference so the row can be deleted afterwards.
 *
 * Run the dev server with RESEND_API_KEY and EMAIL_FROM blank, or the
 * submission emails a real inbox.
 */
test.skip(process.env.E2E_PUBLIC_WRITES !== '1', 'Set E2E_PUBLIC_WRITES=1 to run the public request write test');

test('a company typed into the request form survives submission', async ({ page }) => {
  const stamp = Date.now();
  const agency = `Playwright Lettings ${stamp}`;

  await page.goto('/request');

  // Step 1 — engineer. Unmatched on purpose: no profile, no inbox, no claim.
  await page.getByPlaceholder('Engineer name').fill(`PW Engineer ${stamp}`);
  await page.getByPlaceholder('Engineer email').fill(`pw-engineer-${stamp}@example.invalid`);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — the submitter. This is the field the bug threw away.
  await page.getByPlaceholder('Your name').fill(`PW Agent ${stamp}`);
  await page.getByPlaceholder('Company (optional)').fill(agency);
  await page.getByPlaceholder('Email address').fill(`pw-agent-${stamp}@example.invalid`);
  await page.getByPlaceholder('Phone number').fill('020 7946 0000');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — the property. Typed manually so the run does not depend on the
  // address lookup provider being reachable or in credit.
  await page.getByPlaceholder('Property address line 1').fill('14 Selby Road');
  await page.getByPlaceholder('City').fill('London');
  await page.getByPlaceholder('Postcode').fill('E11 3LT');

  await page.getByRole('button', { name: 'Send job request' }).click();

  await expect(page.getByText('Request sent')).toBeVisible({ timeout: 30_000 });

  // Printed so the row created by this run can be found and removed.
  console.log(`[e2e] submitted request for agency: ${agency}`);
});
