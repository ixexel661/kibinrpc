import type { KibinClient } from '@kibinrpc/client';
import { describe, expect, it, vi } from 'vitest';
import { createKibinQuery } from '../src/query.js';

type MockResult = { ns: string; method: string; args: unknown[] };

type TestRouter = {
	services: {
		user: {
			getUser(id: string): MockResult;
			listUsers(): MockResult[];
			createUser(name: string, email: string): MockResult;
			listAll(): MockResult[];
		};
		post: {
			create(title: string, body: string): MockResult;
		};
	};
};

function makeClient(): KibinClient<TestRouter> {
	return new Proxy(
		{},
		{
			get: (_, ns: string) =>
				new Proxy(
					{},
					{
						get:
							(_, method: string) =>
							(...args: unknown[]) =>
								Promise.resolve({ ns, method, args }),
					},
				),
		},
	) as unknown as KibinClient<TestRouter>;
}

const query = createKibinQuery(makeClient());

describe('queryKey', () => {
	it('namespace key covers all methods in namespace', () => {
		expect(query.user.queryKey()).toEqual(['@kibinrpc', 'user']);
	});

	it('method key without args covers all calls to that method', () => {
		expect(query.user.getUser.queryKey()).toEqual(['@kibinrpc', 'user', 'getUser']);
	});

	it('method key with args identifies a specific call', () => {
		expect(query.user.getUser.queryKey(['id-1'])).toEqual([
			'@kibinrpc',
			'user',
			'getUser',
			{ args: ['id-1'] },
		]);
	});

	it('multiple args are kept in the args array', () => {
		expect(query.post.create.queryKey(['title', 'body'])).toEqual([
			'@kibinrpc',
			'post',
			'create',
			{ args: ['title', 'body'] },
		]);
	});
});

describe('queryOptions', () => {
	it('sets queryKey to the full method+args key', () => {
		const opts = query.user.getUser.queryOptions(['id-1']);
		expect(opts.queryKey).toEqual(['@kibinrpc', 'user', 'getUser', { args: ['id-1'] }]);
	});

	it('queryFn calls the client method with the provided args', async () => {
		const opts = query.user.getUser.queryOptions(['id-1']);
		const result = await (opts as unknown as { queryFn: () => Promise<unknown> }).queryFn();
		expect(result).toMatchObject({ ns: 'user', method: 'getUser', args: ['id-1'] });
	});

	it('merges override options', () => {
		const opts = query.user.getUser.queryOptions(['id-1'], { staleTime: 9999 });
		expect((opts as { staleTime?: number }).staleTime).toBe(9999);
	});

	it('works with no args (zero-arg methods)', async () => {
		const opts = query.user.listAll.queryOptions([]);
		const result = await (opts as unknown as { queryFn: () => Promise<unknown> }).queryFn();
		expect(result).toMatchObject({ ns: 'user', method: 'listAll', args: [] });
	});
});

describe('mutationOptions', () => {
	it('sets mutationKey correctly', () => {
		const opts = query.user.createUser.mutationOptions();
		expect(opts.mutationKey).toEqual(['@kibinrpc', 'user', 'createUser']);
	});

	it('mutationFn spreads the args tuple onto the client method', async () => {
		const opts = query.user.createUser.mutationOptions();
		const result = await (
			opts as unknown as { mutationFn: (vars: unknown) => Promise<unknown> }
		).mutationFn(['Alice', 'alice@example.com']);
		expect(result).toMatchObject({
			ns: 'user',
			method: 'createUser',
			args: ['Alice', 'alice@example.com'],
		});
	});

	it('merges override options', () => {
		const onSuccess = vi.fn();
		const opts = query.user.createUser.mutationOptions({ onSuccess });
		expect(opts.onSuccess).toBe(onSuccess);
	});
});

describe('mutationKey', () => {
	it('returns method-level key', () => {
		expect(query.user.createUser.mutationKey()).toEqual(['@kibinrpc', 'user', 'createUser']);
	});
});

describe('custom queryKeyPrefix', () => {
	it('replaces the default prefix in all keys', () => {
		const q = createKibinQuery(makeClient(), { queryKeyPrefix: 'myapp' });
		expect(q.user.queryKey()).toEqual(['myapp', 'user']);
		expect(q.user.getUser.queryKey(['id-1'])).toEqual([
			'myapp',
			'user',
			'getUser',
			{ args: ['id-1'] },
		]);
		expect(q.user.createUser.mutationKey()).toEqual(['myapp', 'user', 'createUser']);
	});
});
