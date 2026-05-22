import { KibinError } from './errors.js';
import type { KibinClient, KibinClientConfig, RequestCtx } from './types.js';

const RETRY_DEFAULTS = { attempts: 3, delay: 300 };

type RpcResult = { data?: unknown; error?: { code?: string; message?: string } };

export function createKibinClient<Router>(config: KibinClientConfig): KibinClient<Router> {
	const maxAttempts = config.retry?.attempts ?? RETRY_DEFAULTS.attempts;
	const baseDelay = config.retry?.delay ?? RETRY_DEFAULTS.delay;
	const { interceptors } = config;

	async function rpcCall(namespace: string, method: string, args: unknown[]): Promise<unknown> {
		let ctx: RequestCtx = { namespace, method, args };

		if (interceptors?.request) {
			ctx = await interceptors.request(ctx);
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

	return new Proxy(
		{},
		{
			get(_, namespace: string) {
				return new Proxy(
					{},
					{
						get(_, method: string) {
							return (...args: unknown[]) => rpcCall(namespace, method, args);
						},
					},
				);
			},
		},
	) as unknown as KibinClient<Router>;
}
