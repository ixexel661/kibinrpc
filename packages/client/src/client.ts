import { KibinError } from './errors.js';
import type { KibinClient, KibinClientConfig, RequestCtx } from './types.js';

const RETRY_DEFAULTS = { attempts: 3, delay: 300 };

type RpcResult = { data?: unknown; error?: { code?: string; message?: string } };
type BatchRpcResult = RpcResult & { status: number };
type QueueItem = { ctx: RequestCtx; resolve: (v: unknown) => void; reject: (e: unknown) => void };

export function createKibinClient<Router>(config: KibinClientConfig): KibinClient<Router> {
	const maxAttempts = config.retry?.attempts ?? RETRY_DEFAULTS.attempts;
	const baseDelay = config.retry?.delay ?? RETRY_DEFAULTS.delay;
	const { interceptors } = config;

	let pendingBatch: QueueItem[] = [];
	let flushScheduled = false;

	async function rpcCall(namespace: string, method: string, args: unknown[]): Promise<unknown> {
		let ctx: RequestCtx = { namespace, method, args };

		if (interceptors?.request) {
			ctx = await interceptors.request(ctx);
		}

		return new Promise<unknown>((resolve, reject) => {
			pendingBatch.push({ ctx, resolve, reject });
			if (!flushScheduled) {
				flushScheduled = true;
				queueMicrotask(flush);
			}
		});
	}

	function flush() {
		const batch = pendingBatch;
		pendingBatch = [];
		flushScheduled = false;

		if (batch.length === 0) return;
		if (batch.length === 1) {
			flushSingle(batch[0]);
		} else {
			flushBatch(batch);
		}
	}

	async function flushSingle(item: QueueItem) {
		const { ctx } = item;
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
						item.resolve(await interceptors.error({ ...ctx, error: err }));
					} else {
						item.reject(err);
					}
					return;
				}

				if (interceptors?.response) {
					item.resolve(await interceptors.response({ ...ctx, data: result.data }));
				} else {
					item.resolve(result.data);
				}
				return;
			} catch (err) {
				if (err instanceof KibinError) {
					item.reject(err);
					return;
				}
				lastError = err;
			}
		}

		if (lastError instanceof KibinError && interceptors?.error) {
			item.resolve(await interceptors.error({ ...ctx, error: lastError }));
		} else {
			item.reject(lastError);
		}
	}

	async function flushBatch(batch: QueueItem[]) {
		let pending = [...batch];
		const lastErrors = new Map<QueueItem, unknown>();

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (attempt > 0) {
				await new Promise<void>((r) => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
			}

			let results: BatchRpcResult[];
			try {
				const response = await fetch(config.baseUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...config.headers },
					body: JSON.stringify(pending.map((item) => item.ctx)),
				});
				results = (await response.json()) as BatchRpcResult[];
			} catch (err) {
				for (const item of pending) lastErrors.set(item, err);
				continue;
			}

			const retryItems: QueueItem[] = [];

			for (let i = 0; i < pending.length; i++) {
				const result = results[i];
				const item = pending[i];

				if (result?.error) {
					const err = new KibinError(
						result.error.code ?? 'RPC_ERROR',
						result.error.message ?? 'RPC Error',
					);
					if (result.status >= 500) {
						retryItems.push(item);
						lastErrors.set(item, err);
					} else {
						if (interceptors?.error) {
							item.resolve(await interceptors.error({ ...item.ctx, error: err }));
						} else {
							item.reject(err);
						}
					}
				} else {
					if (interceptors?.response) {
						item.resolve(await interceptors.response({ ...item.ctx, data: result?.data }));
					} else {
						item.resolve(result?.data);
					}
				}
			}

			pending = retryItems;
			if (pending.length === 0) break;
		}

		for (const item of pending) {
			const err = lastErrors.get(item);
			if (err instanceof KibinError && interceptors?.error) {
				item.resolve(await interceptors.error({ ...item.ctx, error: err }));
			} else {
				item.reject(err);
			}
		}
	}

	return new Proxy(
		{},
		{
			get(_, key: string) {
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
