import type { KibinClient, KibinError } from '@kibinrpc/client';
import type { MutationObserverOptions, QueryObserverOptions } from '@tanstack/react-query';

type AnyAsyncFn = (...args: never[]) => Promise<unknown>;

export type MethodUtils<F extends AnyAsyncFn> = {
	/**
	 * Returns query options compatible with useQuery, useSuspenseQuery,
	 * prefetchQuery, queryClient.fetchQuery, and more.
	 *
	 * @param args Method arguments as a tuple
	 * @param options Additional QueryObserverOptions to merge
	 */
	queryOptions(
		args: Parameters<F>,
		options?: Omit<
			QueryObserverOptions<Awaited<ReturnType<F>>, KibinError>,
			'queryKey' | 'queryFn'
		>,
	): QueryObserverOptions<Awaited<ReturnType<F>>, KibinError>;

	/**
	 * Returns a stable query key for this method.
	 * Omit `args` to get a broader key that matches all calls to this method.
	 *
	 * @example
	 * query.user.getUser.queryKey(['id-1']) // exact call
	 * query.user.getUser.queryKey()         // all getUser calls
	 */
	queryKey(args?: Parameters<F>): readonly unknown[];

	/**
	 * Returns mutation options for use with useMutation.
	 * Variables passed to `mutate()` must be the argument tuple.
	 *
	 * @example
	 * const { mutate } = useMutation(query.user.createUser.mutationOptions())
	 * mutate(['Alice', 'alice@example.com'])
	 */
	mutationOptions(
		options?: Omit<
			MutationObserverOptions<Awaited<ReturnType<F>>, KibinError, Parameters<F>>,
			'mutationFn' | 'mutationKey'
		>,
	): MutationObserverOptions<Awaited<ReturnType<F>>, KibinError, Parameters<F>>;

	/** Stable mutation key for devtools filtering and tracking */
	mutationKey(): readonly unknown[];
};

type NamespaceUtils<NS extends Record<string, AnyAsyncFn>> = {
	[M in keyof NS]: MethodUtils<NS[M]>;
} & {
	/** Broad query key covering all methods in this namespace — useful for invalidation */
	queryKey(): readonly unknown[];
};

export type KibinQueryProxy<Router> = {
	[NS in Exclude<keyof KibinClient<Router>, '$unbatched'>]: KibinClient<Router>[NS] extends Record<
		string,
		AnyAsyncFn
	>
		? NamespaceUtils<KibinClient<Router>[NS]>
		: never;
};

export interface KibinQueryConfig {
	/** Prefix for all generated query keys. Default: '@kibinrpc' */
	queryKeyPrefix?: string;
}
