import { describe, expect, it } from 'vitest';
import { defineActions, serverAction } from '../src/fn.js';
import { getRegisteredActions, isBrandedAction } from '../src/registry.js';
import { createRouter } from '../src/router.js';
import { MultiService, SingleService } from './fixtures.js';

describe('@ServerAction decorator', () => {
	it('registers decorated methods on the instance', () => {
		const svc = new SingleService();
		const actions = getRegisteredActions(svc);
		expect(actions.has('doSomething')).toBe(true);
	});

	it('does not register undecorated methods', () => {
		const svc = new SingleService();
		const actions = getRegisteredActions(svc);
		expect(actions.has('notRegistered')).toBe(false);
	});

	it('registers multiple decorated methods independently', () => {
		const svc = new MultiService();
		const actions = getRegisteredActions(svc);
		expect(actions.has('a')).toBe(true);
		expect(actions.has('b')).toBe(true);
		expect(actions.has('c')).toBe(false);
	});

	it('allows decorated methods to be called via the router', async () => {
		const { handler } = createRouter({ svc: new SingleService() });
		const res = await handler(
			new Request('http://localhost/rpc', {
				method: 'POST',
				body: JSON.stringify({ namespace: 'svc', method: 'doSomething', args: [] }),
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toBe(42);
	});

	it('rejects undecorated methods via the router', async () => {
		const { handler } = createRouter({ svc: new SingleService() });
		const res = await handler(
			new Request('http://localhost/rpc', {
				method: 'POST',
				body: JSON.stringify({ namespace: 'svc', method: 'notRegistered', args: [] }),
			}),
		);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error.code).toBe('METHOD_NOT_FOUND');
	});
});

describe('serverAction', () => {
	it('brands a function', () => {
		const fn = serverAction(() => 42);
		expect(isBrandedAction(fn)).toBe(true);
	});

	it('returns the same function reference', () => {
		const original = () => 1;
		expect(serverAction(original)).toBe(original);
	});

	it('does not brand plain functions', () => {
		expect(isBrandedAction(() => {})).toBe(false);
	});

	it('returns false for non-functions', () => {
		expect(isBrandedAction(null)).toBe(false);
		expect(isBrandedAction(42)).toBe(false);
	});
});

describe('defineActions', () => {
	it('brands all keys', () => {
		const actions = defineActions({
			list: () => [],
			get: (_id: string) => null,
		});
		expect(isBrandedAction(actions.list)).toBe(true);
		expect(isBrandedAction(actions.get)).toBe(true);
	});

	it('returns the same object reference', () => {
		const obj = { fn: () => 1 };
		expect(defineActions(obj)).toBe(obj);
	});
});
