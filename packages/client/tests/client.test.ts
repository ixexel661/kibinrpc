import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKibinClient } from '../src/client.js';
import { isKibinError } from '../src/errors.js';

function mockFetch(response: unknown, status = 200) {
	return vi.fn().mockResolvedValue({
		status,
		json: () => Promise.resolve(response),
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('single call — success', () => {
	it('sends POST with correct body and resolves with data', async () => {
		const fetch = mockFetch({ data: 42 });
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({ baseUrl: 'http://localhost/rpc' });

		const result = await client.ns.op(7);

		expect(result).toBe(42);
		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('http://localhost/rpc');
		expect(init.method).toBe('POST');
		const body = JSON.parse(init.body as string);
		expect(body).toMatchObject({ namespace: 'ns', method: 'op', args: [7] });
	});

	it('sends custom headers', async () => {
		const fetch = mockFetch({ data: 'ok' });
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			headers: { 'X-Token': 'abc' },
		});

		await client.ns.op();

		const [, init] = fetch.mock.calls[0];
		expect(init.headers['X-Token']).toBe('abc');
	});
});

describe('single call — errors', () => {
	it('rejects with KibinError on 4xx response', async () => {
		vi.stubGlobal('fetch', mockFetch({ error: { code: 'NOT_FOUND', message: 'gone' } }, 404));
		const client = createKibinClient<any>({ baseUrl: 'http://localhost/rpc' });

		const err = await client.ns.op().catch((e) => e);
		expect(isKibinError(err)).toBe(true);
		expect(err.code).toBe('NOT_FOUND');
	});

	it('retries on 5xx and eventually rejects', async () => {
		const fetch = mockFetch({ error: { code: 'INTERNAL_ERROR', message: 'fail' } }, 500);
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			retry: { attempts: 3, delay: 1 },
		});

		await client.ns.op().catch(() => {});

		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('retries on network error', async () => {
		const fetch = vi.fn().mockRejectedValue(new Error('network'));
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			retry: { attempts: 2, delay: 1 },
		});

		await client.ns.op().catch(() => {});

		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('uses default attempts of 3', async () => {
		const fetch = mockFetch({ error: { code: 'SERVER_ERROR', message: 'fail' } }, 500);
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			retry: { attempts: 3, delay: 1 },
		});

		await client.ns.op().catch(() => {});

		expect(fetch).toHaveBeenCalledTimes(3);
	});
});

describe('auto-batching', () => {
	it('sends two concurrent calls as a single array', async () => {
		const fetch = mockFetch([
			{ data: 1, status: 200 },
			{ data: 2, status: 200 },
		]);
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({ baseUrl: 'http://localhost/rpc' });

		const [r1, r2] = await Promise.all([client.ns.a(), client.ns.b()]);

		expect(fetch).toHaveBeenCalledOnce();
		const body = JSON.parse(fetch.mock.calls[0][1].body);
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(2);
		expect(r1).toBe(1);
		expect(r2).toBe(2);
	});

	it('sends a single call as an object (not array)', async () => {
		const fetch = mockFetch({ data: 'solo' });
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({ baseUrl: 'http://localhost/rpc' });

		await client.ns.op();

		const body = JSON.parse(fetch.mock.calls[0][1].body);
		expect(Array.isArray(body)).toBe(false);
	});
});

describe('batch — partial failure & retry', () => {
	it('resolves successful items and rejects 4xx items immediately', async () => {
		const fetch = mockFetch([
			{ data: 'ok', status: 200 },
			{ error: { code: 'NOT_FOUND', message: 'gone' }, status: 404 },
		]);
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({ baseUrl: 'http://localhost/rpc' });

		const [p1, p2] = [client.ns.a(), client.ns.b()];
		expect(await p1).toBe('ok');
		const err = await p2.catch((e) => e);
		expect(isKibinError(err)).toBe(true);
	});

	it('retries only 5xx batch items', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce({
				status: 207,
				json: () =>
					Promise.resolve([
						{ data: 'ok', status: 200 },
						{ error: { code: 'INTERNAL_ERROR', message: 'fail' }, status: 500 },
					]),
			})
			.mockResolvedValueOnce({
				status: 200,
				json: () => Promise.resolve([{ data: 'recovered', status: 200 }]),
			});
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			retry: { attempts: 2, delay: 1 },
		});

		const [r1, r2] = await Promise.all([client.ns.a(), client.ns.b()]);

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(JSON.parse(fetch.mock.calls[1][1].body)).toHaveLength(1);
		expect(r1).toBe('ok');
		expect(r2).toBe('recovered');
	});
});

describe('timeout and abort', () => {
	it('rejects with TIMEOUT when fetch throws TimeoutError', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')),
		);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			timeout: 100,
			retry: { attempts: 1, delay: 1 },
		});

		const err = await client.ns.op().catch((e) => e);
		expect(isKibinError(err)).toBe(true);
		expect(err.code).toBe('TIMEOUT');
	});

	it('rejects with ABORTED when fetch throws AbortError', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
		);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			signal: AbortSignal.abort(),
		});

		const err = await client.ns.op().catch((e) => e);
		expect(isKibinError(err)).toBe(true);
		expect(err.code).toBe('ABORTED');
	});

	it('TIMEOUT does not retry', async () => {
		const fetch = vi
			.fn()
			.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			timeout: 100,
			retry: { attempts: 3, delay: 1 },
		});

		await client.ns.op().catch(() => {});
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('rejects all batch items with ABORTED on batch fetch abort', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
		);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			signal: AbortSignal.abort(),
		});

		const [e1, e2] = await Promise.all([
			client.ns.a().catch((e) => e),
			client.ns.b().catch((e) => e),
		]);
		expect(isKibinError(e1)).toBe(true);
		expect(e1.code).toBe('ABORTED');
		expect(isKibinError(e2)).toBe(true);
		expect(e2.code).toBe('ABORTED');
	});
});

describe('dynamic headers', () => {
	it('calls headers function and sends the result', async () => {
		const fetch = mockFetch({ data: 'ok' });
		vi.stubGlobal('fetch', fetch);
		const getHeaders = vi.fn().mockResolvedValue({ Authorization: 'Bearer token' });
		const client = createKibinClient<any>({ baseUrl: 'http://localhost/rpc', headers: getHeaders });

		await client.ns.op();

		expect(getHeaders).toHaveBeenCalledOnce();
		expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
	});

	it('calls headers function on every retry', async () => {
		const fetch = mockFetch({ error: { code: 'INTERNAL_ERROR', message: 'fail' } }, 500);
		vi.stubGlobal('fetch', fetch);
		let callCount = 0;
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			headers: () => ({ 'X-Count': String(++callCount) }),
			retry: { attempts: 3, delay: 1 },
		});

		await client.ns.op().catch(() => {});
		expect(callCount).toBe(3);
	});
});

describe('interceptors', () => {
	it('request interceptor can modify args', async () => {
		const fetch = mockFetch({ data: 'ok' });
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			interceptors: { request: (ctx) => ({ ...ctx, args: ['injected'] }) },
		});

		await client.ns.op('original');

		const body = JSON.parse(fetch.mock.calls[0][1].body);
		expect(body.args).toEqual(['injected']);
	});

	it('response interceptor transforms the result', async () => {
		vi.stubGlobal('fetch', mockFetch({ data: 5 }));
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			interceptors: { response: ({ data }) => (data as number) * 2 },
		});

		expect(await client.ns.op()).toBe(10);
	});

	it('error interceptor can suppress an error', async () => {
		vi.stubGlobal('fetch', mockFetch({ error: { code: 'NOT_FOUND', message: 'gone' } }, 404));
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			interceptors: { error: () => 'fallback' },
		});

		expect(await client.ns.op()).toBe('fallback');
	});

	it('error interceptor can rethrow', async () => {
		vi.stubGlobal('fetch', mockFetch({ error: { code: 'FORBIDDEN', message: 'no' } }, 403));
		const client = createKibinClient<any>({
			baseUrl: 'http://localhost/rpc',
			interceptors: {
				error: ({ error }) => {
					throw error;
				},
			},
		});

		const err = await client.ns.op().catch((e) => e);
		expect(isKibinError(err)).toBe(true);
	});
});
