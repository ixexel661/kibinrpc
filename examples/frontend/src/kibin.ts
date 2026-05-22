import type { AppRouter } from '@app/backend/router';
import { createKibinClient, type KibinClient } from '@kibinrpc/client';

export const client: KibinClient<AppRouter> = createKibinClient<AppRouter>({
	baseUrl: '/api/rpc',
	interceptors: {
		request: (ctx) => {
			console.log(`[RPC] → ${ctx.namespace}.${ctx.method}`, ctx.args);
			return ctx;
		},
		response: ({ namespace, method, data }) => {
			console.log(`[RPC] ← ${namespace}.${method}`, data);
			return data;
		},
		error: ({ namespace, method, error }) => {
			console.error(`[RPC] ✗ ${namespace}.${method}`, error.code, error.message);
			throw error;
		},
	},
});
