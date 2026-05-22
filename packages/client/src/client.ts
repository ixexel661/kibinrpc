import { KibinError } from './errors.js';
import type { KibinClient, KibinClientConfig } from './types.js';

export function createKibinClient<Router>(config: KibinClientConfig): KibinClient<Router> {
	return new Proxy(
		{},
		{
			get(_, namespace: string) {
				return new Proxy(
					{},
					{
						get(_, method: string) {
							return async (...args: unknown[]) => {
								const response = await fetch(config.baseUrl, {
									method: 'POST',
									headers: {
										'Content-Type': 'application/json',
										...config.headers,
									},
									body: JSON.stringify({ namespace, method, args }),
								});

								const result = await response.json();

								if (result.error) {
									throw new KibinError(
										result.error.code ?? 'RPC_ERROR',
										result.error.message ?? 'RPC Error',
									);
								}

								return result.data;
							};
						},
					},
				);
			},
		},
	) as unknown as KibinClient<Router>;
}
