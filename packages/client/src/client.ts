import { KibinError } from './errors.js';
import type { KibinClient, KibinClientConfig, RequestCtx } from './types.js';

const RETRY_DEFAULTS = { attempts: 3, delay: 300 };

type RpcResult = { data?: unknown; error?: { code?: string; message?: string } };
type QueueItem = { ctx: RequestCtx; resolve: (v: unknown) => void; reject: (e: unknown) => void };

export function createKibinClient<Router>(config: KibinClientConfig): KibinClient<Router> {
	const maxAttempts = config.retry?.attempts ?? RETRY_DEFAULTS.attempts;
	const baseDelay = config.retry?.delay ?? RETRY_DEFAULTS.delay;
	const batchUrl = config.batchUrl ?? `${config.baseUrl}/batch`;
	const { interceptors } = config;

	let currentBatch: QueueItem[] | null = null;

	async function rpcCall(namespace: string, method: string, args: unknown[]): Promise<unknown> {
		let ctx: RequestCtx = { namespace, method, args };

		if (interceptors?.request) {
			ctx = await interceptors.request(ctx);
		}

		if (currentBatch !== null) {
			const batch = currentBatch;
			return new Promise((resolve, reject) => {
				batch.push({ ctx, resolve, reject });
			});
		}

		let lastError: unknown;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (attempt > 0) {
				await new Promise<void>((resolve) => setTimeout(resolve, baseDelay * 2 ** (attempt - 1)));
			}

			try {
				const response = await fetch(config.baseUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...config.headers },
					body: JSON.stringify(ctx),
				});

				const result = (await response.json()) as RpcResult;

				if (result.error) {
					const err = new KibinError(
						result.error.code ?? 'RPC_ERROR',
						result.error.message ?? 'RPC Error',
					);
					if (response.status >= 500) {
						lastError = err;
						continue;
					}
					if (interceptors?.error) {
						return await interceptors.error({ ...ctx, error: err });
					}
					throw err;
				}

				if (interceptors?.response) {
					return await interceptors.response({ ...ctx, data: result.data });
				}

				return result.data;
			} catch (err) {
				if (err instanceof KibinError) throw err;
				lastError = err;
			}
		}

		if (lastError instanceof KibinError && interceptors?.error) {
			return await interceptors.error({ ...ctx, error: lastError });
		}

		throw lastError;
	}

	async function $batch<T extends Array<() => Promise<unknown>>>(
		thunks: [...T],
	): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
		const queue: QueueItem[] = [];
		currentBatch = queue;
		const promises = thunks.map((thunk) => thunk());
		currentBatch = null;

		const response = await fetch(batchUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...config.headers },
			body: JSON.stringify(queue.map((item) => item.ctx)),
		});

		const results = (await response.json()) as RpcResult[];

		for (let i = 0; i < queue.length; i++) {
			const result = results[i];
			if (result?.error) {
				const err = new KibinError(
					result.error.code ?? 'RPC_ERROR',
					result.error.message ?? 'RPC Error',
				);
				if (interceptors?.error) {
					queue[i].resolve(await interceptors.error({ ...queue[i].ctx, error: err }));
				} else {
					queue[i].reject(err);
				}
			} else {
				const data = result?.data;
				if (interceptors?.response) {
					queue[i].resolve(await interceptors.response({ ...queue[i].ctx, data }));
				} else {
					queue[i].resolve(data);
				}
			}
		}

		return Promise.all(promises) as Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }>;
	}

	return new Proxy(
		{},
		{
			get(_, key: string) {
				if (key === '$batch') return $batch;
				return new Proxy(
					{},
					{
						get(_, method: string) {
							return (...args: unknown[]) => rpcCall(key, method, args);
						},
					},
				);
			},
		},
	) as unknown as KibinClient<Router>;
}
