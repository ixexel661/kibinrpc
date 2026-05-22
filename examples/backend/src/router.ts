import { createRouter } from '@kibinrpc/server';
import { postActions, UserActions } from './actions.js';

export const router = createRouter(
	{
		user: new UserActions(),
		post: postActions,
	},
	{
		beforeAction: ({ namespace, method }) => {
			console.log(`[RPC] → ${namespace}.${method}`);
		},
		afterAction: ({ namespace, method, result }) => {
			console.log(`[RPC] ← ${namespace}.${method}`, result);
		},
		onError: ({ namespace, method, error }) => {
			console.error(`[RPC] ✗ ${namespace}.${method}`, error);
		},
	},
);

export type AppRouter = typeof router;
