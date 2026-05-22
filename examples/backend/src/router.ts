import { createRouter } from '@kibinrpc/server';
import { postActions, UserActions } from './actions.js';

export const router = createRouter({
	user: new UserActions(),
	post: postActions,
});

export type AppRouter = typeof router;
