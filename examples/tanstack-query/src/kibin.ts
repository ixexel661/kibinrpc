import type { AppRouter } from '@app/backend/router';
import { createKibinClient, type KibinClient } from '@kibinrpc/client';
import { createKibinQuery, type KibinQueryProxy } from '@kibinrpc/tanstack-query';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Treat data as fresh for 30s to avoid redundant refetches
			staleTime: 30_000,
			// Retry once on failure before surfacing the error
			retry: 1,
		},
	},
});

export const client: KibinClient<AppRouter> = createKibinClient<AppRouter>({
	baseUrl: '/api/rpc',
});

// query.user.listUsers.queryOptions([])
// query.user.createUser.mutationOptions({ onSuccess: ... })
// query.user.queryKey() broad key for invalidation
export const query: KibinQueryProxy<AppRouter> = createKibinQuery(client);
