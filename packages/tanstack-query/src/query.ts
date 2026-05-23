import type { KibinClient } from '@kibinrpc/client';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { KibinQueryConfig, KibinQueryProxy } from './types.js';

const DEFAULT_PREFIX = '@kibinrpc';

type AnyFn = (...args: unknown[]) => Promise<unknown>;
type AnyRecord = Record<string, AnyFn>;

export function createKibinQuery<Router>(
	client: KibinClient<Router>,
	config: KibinQueryConfig = {},
): KibinQueryProxy<Router> {
	const prefix = config.queryKeyPrefix ?? DEFAULT_PREFIX;

	function nsKey(namespace: string): readonly unknown[] {
		return [prefix, namespace];
	}

	function methodKey(namespace: string, method: string, args?: unknown[]): readonly unknown[] {
		if (args !== undefined) return [prefix, namespace, method, { args }];
		return [prefix, namespace, method];
	}

	function makeMethodUtils(namespace: string, method: string) {
		const fn = (client as Record<string, AnyRecord>)[namespace][method];

		return {
			queryOptions(args: unknown[], options = {}) {
				return queryOptions({
					queryKey: methodKey(namespace, method, args),
					queryFn: () => fn(...args),
					...options,
				});
			},

			queryKey(args?: unknown[]) {
				return methodKey(namespace, method, args);
			},

			mutationOptions(options = {}) {
				return mutationOptions({
					mutationKey: methodKey(namespace, method),
					mutationFn: (args: unknown[]) => fn(...args),
					...options,
				});
			},

			mutationKey() {
				return methodKey(namespace, method);
			},
		};
	}

	function makeNamespaceProxy(namespace: string) {
		return new Proxy(
			{},
			{
				get(_, prop: string | symbol) {
					if (prop === 'queryKey') return () => nsKey(namespace);
					if (typeof prop !== 'string') return undefined;
					return makeMethodUtils(namespace, prop);
				},
			},
		);
	}

	return new Proxy(
		{},
		{
			get(_, namespace: string | symbol) {
				if (typeof namespace !== 'string') return undefined;
				return makeNamespaceProxy(namespace);
			},
		},
	) as unknown as KibinQueryProxy<Router>;
}
