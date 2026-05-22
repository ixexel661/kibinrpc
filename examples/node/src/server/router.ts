import { createRouter } from '@kibin/server';
import { UserActions } from './actions.js';

export const router = createRouter({
	user: new UserActions(),
});

export type AppRouter = typeof router;
