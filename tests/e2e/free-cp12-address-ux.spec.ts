import { expect, test } from '@playwright/test';

test('free CP12 uses inline address lookup and a clear same-address action', async ({ page }) => {
  await page.goto('/free-cp12');

  const propertyAddress = page.getByPlaceholder('Start typing the property address or postcode');
  const landlordAddress = page.getByPlaceholder("Start typing the landlord's address or postcode");
  await expect(propertyAddress).toHaveAttribute('role', 'combobox');
  await expect(landlordAddress).toHaveAttribute('role', 'combobox');

  await expect(page.getByRole('button', { name: /find property address/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /find landlord address/i })).toHaveCount(0);

  const sameAddress = page.getByRole('button', { name: 'Use same as property address' });
  await expect(sameAddress).toBeDisabled();
  await propertyAddress.fill('10 Test Street');
  await expect(sameAddress).toBeEnabled();
  await sameAddress.click();

  await expect(landlordAddress).toHaveValue('10 Test Street');
  await expect(page.getByRole('button', { name: 'Using property address' })).toBeVisible();
});
