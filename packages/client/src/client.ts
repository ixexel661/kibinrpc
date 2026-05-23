import { KibinError } from './errors.js';
import type { KibinClient, KibinClientConfig, RequestCtx } from './types.js';

const RETRY_DEFAULTS = { attempts: 3, delay: 300 };

type RpcResult = { data?: unknown; error?: { code?: string; message?: string } };
type BatchRpcResult = RpcResult & { status: number };
type QueueItem = { ctx: RequestCtx; resolve: (v: unknown) => void; reject: (e: unknown) => void };

function rpcError(error: { code?: string; message?: string }): KibinError {
	return new KibinError(error.code ?? 'RPC_ERROR', error.message ?? 'RPC Error');
}

function sleep(attempt: number, baseDelay: number): Promise<void> {
	return new Promise<void>((r) => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
}

export function createKibinClient<Router>(config: KibinClientConfig): KibinClient<Router> {
	const maxAttempts = config.retry?.attempts ?? RETRY_DEFAULTS.attempts;
	const baseDelay = config.retry?.delay ?? RETRY_DEFAULTS.delay;
	const { interceptors } = config;

	async function getHeaders(): Promise<Record<string, string>> {
		if (!config.headers) return {};
		if (typeof config.headers === 'function') return await config.headers();
		return config.headers;
	}

	function makeSignal(): AbortSignal | undefined {
		if (config.signal && config.timeout !== undefined) {
			return AbortSignal.any([config.signal, AbortSignal.timeout(config.timeout)]);
		}
		if (config.signal) return config.signal;
		if (config.timeout !== undefined) return AbortSignal.timeout(config.timeout);
		return undefined;
	}

	let pendingBatch: QueueItem[] = [];
	let flushScheduled = false;

	async function settleError(item: QueueItem, err: KibinError): Promise<void> {
		if (interceptors?.error) {
			try {
				item.resolve(await interceptors.error({ ...item.ctx, error: err }));
			} catch (interceptorError) {
				item.reject(interceptorError);
			}
		} else {
			item.reject(err);
		}
	}

	async function settleSuccess(item: QueueItem, data: unknown): Promise<void> {
		if (interceptors?.response) {
			try {
				item.resolve(await interceptors.response({ ...item.ctx, data }));
			} catch (interceptorError) {
				item.reject(interceptorError);
			}
		} else {
			item.resolve(data);
		}
	}

	async function rpcCall(
		namespace: string,
		method: string,
		args: unknown[],
		skipBatch = false,
	): Promise<unknown> {
		let ctx: RequestCtx = { namespace, method, args };

		if (interceptors?.request) {
			ctx = await interceptors.request(ctx);
		}

		return new Promise<unknown>((resolve, reject) => {
			if (skipBatch) {
				flushSingle({ ctx, resolve, reject });
				return;
			}
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
		let lastError: unknown;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (attempt > 0) await sleep(attempt, baseDelay);

			try {
				const resolvedHeaders = await getHeaders();
				const response = await fetch(config.baseUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...resolvedHeaders },
					signal: makeSignal(),
					body: JSON.stringify(item.ctx),
				});

				const result = (await response.json()) as RpcResult;

				if (result.error) {
					const err = rpcError(result.error);
					if (response.status >= 500) {
						lastError = err;
						continue;
					}
					await settleError(item, err);
					return;
				}

				await settleSuccess(item, result.data);
				return;
			} catch (err) {
				if (err instanceof Error && err.name === 'TimeoutError') {
					await settleError(item, new KibinError('TIMEOUT', 'Request timed out', { cause: err }));
					return;
				}
				if (err instanceof Error && err.name === 'AbortError') {
					await settleError(item, new KibinError('ABORTED', 'Request was aborted', { cause: err }));
					return;
				}
				lastError = err;
			}
		}

		if (lastError instanceof KibinError) {
			await settleError(item, lastError);
		} else {
			item.reject(lastError);
		}
	}

	async function flushBatch(batch: QueueItem[]) {
		let pending = [...batch];
		const lastErrors = new Map<QueueItem, unknown>();

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (attempt > 0) await sleep(attempt, baseDelay);

			let results: BatchRpcResult[];
			try {
				const resolvedHeaders = await getHeaders();
				const response = await fetch(config.baseUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...resolvedHeaders },
					signal: makeSignal(),
					body: JSON.stringify(pending.map((item) => item.ctx)),
				});
				results = (await response.json()) as BatchRpcResult[];
			} catch (err) {
				if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
					const code = err.name === 'TimeoutError' ? 'TIMEOUT' : 'ABORTED';
					const msg = err.name === 'TimeoutError' ? 'Request timed out' : 'Request was aborted';
					await Promise.all(
						pending.map((item) => settleError(item, new KibinError(code, msg, { cause: err }))),
					);
					return;
				}
				for (const item of pending) lastErrors.set(item, err);
				continue;
			}

			const retryItems: QueueItem[] = [];
			const settlements: Promise<void>[] = [];

			for (let i = 0; i < pending.length; i++) {
				const result = results[i];
				const item = pending[i];

				if (!result) {
					item.reject(
						new KibinError('BATCH_MISMATCH', 'Server returned fewer results than expected'),
					);
					continue;
				}

				if (result.error) {
					const err = rpcError(result.error);
					if (result.status >= 500) {
						retryItems.push(item);
						lastErrors.set(item, err);
					} else {
						settlements.push(settleError(item, err));
					}
				} else {
					settlements.push(settleSuccess(item, result.data));
				}
			}

			await Promise.all(settlements);
			pending = retryItems;
			if (pending.length === 0) break;
		}

		await Promise.all(
			pending.map((item) => {
				const err = lastErrors.get(item);
				if (err instanceof KibinError) return settleError(item, err);
				item.reject(err);
				return Promise.resolve();
			}),
		);
	}

	function makeNamespaceProxy(namespace: string, skipBatch: boolean) {
		return new Proxy(
			{},
			{
				get(_, method) {
					if (typeof method !== 'string') return undefined;
					return (...args: unknown[]) => rpcCall(namespace, method, args, skipBatch);
				},
			},
		);
	}

	const unbatchedProxy = new Proxy(
		{},
		{
			get(_, key) {
				if (typeof key !== 'string') return undefined;
				return makeNamespaceProxy(key, true);
			},
		},
	);

	return new Proxy(
		{},
		{
			get(_, key) {
				if (key === '$unbatched') return unbatchedProxy;
				if (typeof key !== 'string') return undefined;
				return makeNamespaceProxy(key, false);
			},
		},
	) as unknown as KibinClient<Router>;
}
