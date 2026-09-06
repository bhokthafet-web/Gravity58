import { test, expect } from '@playwright/test';
import { monitorPageErrors, prepareMockApi } from './helpers.js';

const owner = { $id: 'retention-owner', email: 'owner@example.com', name: 'Retention Owner' };
const oldDate = new Date(Date.now() - 350 * 86400000).toISOString();

async function expectProtectedDelete(page) {
  const button = page.getByRole('button', { name: 'Backup CSV & Delete History Permanently' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole('heading', { name: /Back up and permanently delete/ })).toBeVisible();
  await expect(page.getByLabel('Current login password')).toBeVisible();
  await expect(page.getByLabel('Type DELETE')).toBeVisible();
  await expect(page.getByText(/customer login accounts are not deleted/i)).toBeVisible();
}

test('Digital Menu dashboard exposes same-day CSV export without long-term backup controls', async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareMockApi(page, { initialUser: owner, seed: {
    [`digital_menu_${owner.$id}`]: [{ id: 'restaurant-retention', ownerId: owner.$id, restaurant: { id: 'restaurant-retention', name: 'Retention Kitchen', city: 'Hyderabad', type: 'Restaurant', open: true, accepting: true }, categories: [], items: [] }],
    [`digital_order_${owner.$id}`]: [{ id: 'old-complete', ownerId: owner.$id, restaurantId: 'restaurant-retention', status: 'Completed', items: [], total: 100, createdAt: oldDate, updatedAt: oldDate }],
  } });
  await page.goto('/digital-menu/');
  await expect(page.getByRole('button', { name: 'Export Today CSV' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Backup CSV & Delete History Permanently' })).toHaveCount(0);
  await expect(page.locator('#page')).toContainText('order data resets every 24 hours');
  await assertNoErrors();
});

test('Refills Store dashboard exposes password-protected order and booking deletion', async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareMockApi(page, { initialUser: owner, seed: {
    digit58_entitlements: [{ id: 'retention-entitlement', ownerId: owner.$id, active: true, lifetime: true, policyAcceptedAt: oldDate }],
    [`digit58_store_${owner.$id}`]: [{ id: 'retention-store', ownerId: owner.$id, name: 'Retention Store', city: 'Hyderabad', category: 'Store' }],
    [`digit58_order_${owner.$id}`]: [{ id: 'delivered-order', ownerId: owner.$id, storeId: 'retention-store', status: 'Delivered', items: [{ name: 'Item', qty: 1 }], amount: 100, createdAt: oldDate, deliveredAt: oldDate }],
  } });
  await page.goto('/digit58/');
  await expectProtectedDelete(page);
  await assertNoErrors();
});

test('Service dashboard exposes password-protected booking history deletion', async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareMockApi(page, { initialUser: owner, seed: {
    bookings: [{ id: 'expired-booking', customerId: owner.$id, title: 'Expired Campaign', status: 'Expired', amount: 120, createdAt: oldDate, expiresAt: oldDate }],
  } });
  await page.goto('/advertise/');
  await expectProtectedDelete(page);
  await assertNoErrors();
});

test('POS dashboard exposes password-protected local and cloud bill deletion', async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await page.addInitScript(({ date }) => localStorage.setItem('g58Bills', JSON.stringify([{ billNumber: 'G58-OLD', date, total: 100, items: [] }])), { date: oldDate });
  await prepareMockApi(page, { initialUser: owner, state: null });
  await page.goto('/pos/');
  if (await page.locator('#posGuideModal.show').count()) await page.locator('#startUsingPosBtn').click({ force: true });
  await page.evaluate(({ date })=>{localStorage.setItem('g58Bills',JSON.stringify([{billNumber:'G58-OLD',date,total:100,items:[]}])) ;window.G58MountPosRetention?.()}, { date: oldDate });
  await expectProtectedDelete(page);
  await assertNoErrors();
});
