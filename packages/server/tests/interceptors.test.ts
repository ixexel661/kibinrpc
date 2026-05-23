import { describe, expect, it, vi } from 'vitest';
import { KibinError } from '../src/errors.js';
import { defineActions } from '../src/fn.js';
import { createRouter } from '../src/router.js';

function makeRequest(body: unknown) {
	return new Request('http://localhost/rpc', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

const services = {
	math: defineActions({
		add: (a: number, b: number) => a + b,
		fail: () => {
			throw new KibinError('FAIL', 'intentional');
		},
	}),
};

describe('beforeAction', () => {
	it('is called before the action with correct ctx', async () => {
		const beforeAction = vi.fn();
		const { handler } = createRouter(services, { beforeAction });
		await handler(makeRequest({ namespace: 'math', method: 'add', args: [1, 2] }));
		expect(beforeAction).toHaveBeenCalledOnce();
		expect(beforeAction).toHaveBeenCalledWith(
			expect.objectContaining({ namespace: 'math', method: 'add', args: [1, 2] }),
		);
	});

	it('throwing in beforeAction prevents action execution and returns error', async () => {
		const actionFn = vi.fn();
		const svc = defineActions({ act: actionFn });
		const { handler } = createRouter(
			{ svc },
			{
				beforeAction: () => {
					throw new KibinError('UNAUTHORIZED', 'blocked');
				},
			},
		);
		const res = await handler(makeRequest({ namespace: 'svc', method: 'act', args: [] }));
		expect(actionFn).not.toHaveBeenCalled();
		const body = await res.json();
		expect(body.error.code).toBe('UNAUTHORIZED');
	});
});

describe('afterAction', () => {
	it('can transform the result', async () => {
		const { handler } = createRouter(services, {
			afterAction: ({ result }) => (result as number) * 10,
		});
		const res = await handler(makeRequest({ namespace: 'math', method: 'add', args: [1, 2] }));
		const body = await res.json();
		expect(body.data).toBe(30);
	});

	it('returning undefined leaves the result unchanged', async () => {
		const { handler } = createRouter(services, {
			afterAction: () => undefined,
		});
		const res = await handler(makeRequest({ namespace: 'math', method: 'add', args: [2, 3] }));
		const body = await res.json();
		expect(body.data).toBe(5);
	});
});

describe('onError', () => {
	it('is called when an action throws KibinError', async () => {
		const onError = vi.fn();
		const { handler } = createRouter(services, { onError });
		await handler(makeRequest({ namespace: 'math', method: 'fail', args: [] }));
		expect(onError).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({ namespace: 'math', method: 'fail' }),
		);
	});

	it('is called for unknown errors', async () => {
		const onError = vi.fn();
		const svc = defineActions({
			boom: () => {
				throw new Error('boom');
			},
		});
		const { handler } = createRouter({ svc }, { onError });
		await handler(makeRequest({ namespace: 'svc', method: 'boom', args: [] }));
		expect(onError).toHaveBeenCalledOnce();
	});

	it('is not called on success', async () => {
		const onError = vi.fn();
		const { handler } = createRouter(services, { onError });
		await handler(makeRequest({ namespace: 'math', method: 'add', args: [1, 1] }));
		expect(onError).not.toHaveBeenCalled();
	});
});
