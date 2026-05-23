import { describe, expect, it } from 'vitest';
import { isKibinError, KibinError } from '../src/index.js';
import { createRouter } from '../src/router.js';

// ─── Minimal test router ──────────────────────────────────────────────────────

import { defineActions } from '../src/fn.js';

const actions = defineActions({
	async ping() {
		return 'pong';
	},
	async requireAuth() {
		throw new KibinError('UNAUTHORIZED', 'Invalid token');
	},
	async requireRole() {
		throw new KibinError('FORBIDDEN', 'Access denied');
	},
});

const { handler } = createRouter({ svc: actions });

function makeRequest(body: unknown): Request {
	return new Request('http://localhost/api/rpc', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

// ─── KibinError unit tests ────────────────────────────────────────────────────

describe('KibinError', () => {
	it('sets code, message and name', () => {
		const err = new KibinError('NOT_FOUND', 'User not found');
		expect(err.code).toBe('NOT_FOUND');
		expect(err.message).toBe('User not found');
		expect(err.name).toBe('KibinError');
	});

	it('is an instance of Error', () => {
		expect(new KibinError('X', 'y')).toBeInstanceOf(Error);
	});
});

// ─── isKibinError ─────────────────────────────────────────────────────────────

describe('isKibinError', () => {
	it('returns true for a KibinError', () => {
		expect(isKibinError(new KibinError('NOT_FOUND', 'x'))).toBe(true);
	});

	it('returns false for a plain Error', () => {
		expect(isKibinError(new Error('x'))).toBe(false);
	});

	it('narrows to a specific code when provided', () => {
		const err = new KibinError('UNAUTHORIZED', 'x');
		expect(isKibinError(err, 'UNAUTHORIZED')).toBe(true);
		expect(isKibinError(err, 'FORBIDDEN')).toBe(false);
	});
});

// ─── HTTP status mapping ──────────────────────────────────────────────────────

describe('HTTP status codes', () => {
	it('returns 401 for UNAUTHORIZED', async () => {
		const res = await handler(makeRequest({ namespace: 'svc', method: 'requireAuth', args: [] }));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error.code).toBe('UNAUTHORIZED');
	});

	it('returns 403 for FORBIDDEN', async () => {
		const res = await handler(makeRequest({ namespace: 'svc', method: 'requireRole', args: [] }));
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error.code).toBe('FORBIDDEN');
	});
});

// ─── args validation ──────────────────────────────────────────────────────────

describe('args validation', () => {
	it('returns 400 BAD_REQUEST when args is a string', async () => {
		const res = await handler(
			makeRequest({ namespace: 'svc', method: 'ping', args: 'not-an-array' }),
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe('BAD_REQUEST');
	});

	it('returns 400 BAD_REQUEST when args is an object', async () => {
		const res = await handler(makeRequest({ namespace: 'svc', method: 'ping', args: { x: 1 } }));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe('BAD_REQUEST');
	});

	it('returns 400 BAD_REQUEST when args is null', async () => {
		const res = await handler(makeRequest({ namespace: 'svc', method: 'ping', args: null }));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe('BAD_REQUEST');
	});
});
