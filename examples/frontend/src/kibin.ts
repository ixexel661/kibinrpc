import type { AppRouter } from '@app/backend/router';
import { createKibinClient, type KibinClient } from '@kibin/client';

export const client: KibinClient<AppRouter> = createKibinClient<AppRouter>({
	baseUrl: '/api/rpc',
});
