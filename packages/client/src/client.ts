import { KibinError } from './errors.js';
import type { KibinClient, KibinClientConfig } from './types.js';

const RETRY_DEFAULTS = { attempts: 3, delay: 300 };

type RpcResult = { data?: unknown; error?: { code?: string; message?: string } };

export function createKibinClient<Router>(config: KibinClientConfig): KibinClient<Router> {
	const maxAttempts = config.retry?.attempts ?? RETRY_DEFAULTS.attempts;
	const baseDelay = config.retry?.delay ?? RETRY_DEFAULTS.delay;

	async function rpcCall(namespace: string, method: string, args: unknown[]): Promise<unknown> {
		let lastError: unknown;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (attempt > 0) {
				await new Promise<void>((resolve) => setTimeout(resolve, baseDelay * 2 ** (attempt - 1)));
			}

			try {
				const response = await fetch(config.baseUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...config.headers },
					body: JSON.stringify({ namespace, method, args }),
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
					throw err;
				}

				return result.data;
			} catch (err) {
				if (err instanceof KibinError) throw err;
				lastError = err;
			}
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
