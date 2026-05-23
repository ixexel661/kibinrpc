import { describe, expect, it } from 'vitest';
import { KibinError } from '../src/errors.js';
import { defineActions } from '../src/fn.js';
import { createRouter } from '../src/router.js';
import { makeRequest } from './fixtures.js';

const services = {
	math: defineActions({
		add: (a: number, b: number) => a + b,
		echo: (x: unknown) => x,
		notFound: () => {
			throw new KibinError('NOT_FOUND', 'missing');
		},
		badReq: () => {
			throw new KibinError('BAD_REQUEST', 'invalid');
		},
		crash: () => {
			throw new Error('boom');
		},
	}),
};

const { handler } = createRouter(services);

describe('single request — success', () => {
	it('returns 200 with data', async () => {
		const res = await handler(makeRequest({ namespace: 'math', method: 'add', args: [2, 3] }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toBe(5);
	});

	it('sets Content-Type: application/json', async () => {
		const res = await handler(makeRequest({ namespace: 'math', method: 'add', args: [1, 1] }));
		expect(res.headers.get('Content-Type')).toBe('application/json');
	});
});

describe('single request — errors', () => {
	it('returns 400 for invalid JSON', async () => {
		const res = await handler(
			new Request('http://localhost/rpc', { method: 'POST', body: '{bad}' }),
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe('BAD_REQUEST');
	});

	it('returns 404 for unknown namespace', async () => {
		const res = await handler(makeRequest({ namespace: 'unknown', method: 'add', args: [] }));
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error.code).toBe('NOT_FOUND');
	});

	it('returns 404 for unregistered method', async () => {
		// math object has no unregistered method callable
		const svc = { thing: { secret: () => 'private' } };
		const { handler: h } = createRouter(svc);
		const res = await h(makeRequest({ namespace: 'thing', method: 'secret', args: [] }));
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error.code).toBe('METHOD_NOT_FOUND');
	});

	it('returns 404 for KibinError NOT_FOUND', async () => {
		const res = await handler(makeRequest({ namespace: 'math', method: 'notFound', args: [] }));
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error.code).toBe('NOT_FOUND');
	});

	it('returns 400 for KibinError BAD_REQUEST', async () => {
		const res = await handler(makeRequest({ namespace: 'math', method: 'badReq', args: [] }));
		expect(res.status).toBe(400);
	});

	it('returns 500 and hides message for unknown errors', async () => {
		const res = await handler(makeRequest({ namespace: 'math', method: 'crash', args: [] }));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error.code).toBe('INTERNAL_ERROR');
		expect(body.error.message).not.toContain('boom');
	});
});

describe('batch request', () => {
	it('returns 200 when all items succeed', async () => {
		const res = await handler(
			makeRequest([
				{ namespace: 'math', method: 'add', args: [1, 2] },
				{ namespace: 'math', method: 'add', args: [3, 4] },
			]),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body[0].status).toBe(200);
		expect(body[0].data).toBe(3);
		expect(body[1].status).toBe(200);
		expect(body[1].data).toBe(7);
	});

	it('returns 207 when any item fails', async () => {
		const res = await handler(
			makeRequest([
				{ namespace: 'math', method: 'add', args: [1, 1] },
				{ namespace: 'math', method: 'notFound', args: [] },
			]),
		);
		expect(res.status).toBe(207);
		const body = await res.json();
		expect(body[0].status).toBe(200);
		expect(body[1].status).toBe(404);
		expect(body[1].error.code).toBe('NOT_FOUND');
	});

	it('each item carries its own status', async () => {
		const res = await handler(
			makeRequest([
				{ namespace: 'math', method: 'notFound', args: [] },
				{ namespace: 'math', method: 'badReq', args: [] },
				{ namespace: 'math', method: 'crash', args: [] },
			]),
		);
		expect(res.status).toBe(207);
		const [a, b, c] = await res.json();
		expect(a.status).toBe(404);
		expect(b.status).toBe(400);
		expect(c.status).toBe(500);
	});
});
