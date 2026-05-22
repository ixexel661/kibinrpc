import { createKibinClient } from '@kibinrpc/client';
import type { AppRouter } from '../server/router.js';

export const client = createKibinClient<AppRouter>({
	baseUrl: 'http://localhost:3000/api/rpc',
});
