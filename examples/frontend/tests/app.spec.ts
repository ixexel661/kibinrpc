import { expect, test } from '@playwright/test';

test('page loads and shows users and posts', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h2').first()).toHaveText('Users');
	await expect(page.locator('li').filter({ hasText: 'Alice' })).toBeVisible();
	await expect(page.locator('li').filter({ hasText: 'Bob' })).toBeVisible();
	await expect(page.locator('h2').nth(1)).toHaveText('Posts');
});

test('page load triggers a single batched RPC request', async ({ page }) => {
	const requests: string[] = [];

	page.on('request', (req) => {
		if (req.url().includes('/api/rpc') && req.method() === 'POST') {
			requests.push(req.postData() ?? '');
		}
	});

	await page.goto('/');
	await page.locator('li').first().waitFor();

	expect(requests).toHaveLength(1);
	const body = JSON.parse(requests[0]);
	expect(Array.isArray(body)).toBe(true);
	expect(body).toHaveLength(2);
});

test('create user appears in the list', async ({ page }) => {
	await page.goto('/');
	await page.locator('li').first().waitFor();

	await page.getByPlaceholder('Name').fill('Playwright User');
	await page.getByPlaceholder('Email').fill('pw@example.com');
	await page.getByRole('button', { name: 'Add User' }).click();

	await expect(page.locator('li').filter({ hasText: 'Playwright User' })).toBeVisible();
});

test('create post appears in the list', async ({ page }) => {
	await page.goto('/');
	await page.locator('li').first().waitFor();

	await page.getByPlaceholder('Title').fill('E2E Post');
	await page.getByPlaceholder('Body').fill('written by playwright');
	await page.getByPlaceholder('Author ID').fill('1');
	await page.getByRole('button', { name: 'Add Post' }).click();

	await expect(page.locator('li').filter({ hasText: 'E2E Post' })).toBeVisible();
});
