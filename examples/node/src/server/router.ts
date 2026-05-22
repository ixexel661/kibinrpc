import { createRouter } from '@kibinrpc/server';
import { UserActions } from './actions.js';

export const router = createRouter({
	user: new UserActions(),
});

export type AppRouter = typeof router;
