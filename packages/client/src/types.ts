import type { KibinError } from './errors.js';

type AsyncifyMethod<T> = T extends (...args: infer Args) => infer Return
	? (...args: Args) => Promise<Awaited<Return>>
	: never;

type ServiceClient<T> = {
	[K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: AsyncifyMethod<T[K]>;
};

type ExtractServices<T> = T extends { services: infer S } ? S : never;

type RouterServices<Router> = {
	[K in keyof ExtractServices<Router>]: ServiceClient<ExtractServices<Router>[K]>;
};

export type KibinClient<Router> = RouterServices<Router> & {
	$unbatched: RouterServices<Router>;
};

export interface RequestCtx {
	namespace: string;
	method: string;
	args: unknown[];
}

export interface ResponseCtx extends RequestCtx {
	data: unknown;
}

export interface ErrorCtx extends RequestCtx {
	error: KibinError;
}

export interface ClientInterceptors {
	request?: (ctx: RequestCtx) => RequestCtx | Promise<RequestCtx>;
	response?: (ctx: ResponseCtx) => unknown | Promise<unknown>;
	error?: (ctx: ErrorCtx) => unknown | Promise<unknown>;
}

export interface RetryConfig {
	/** Total number of attempts. Default: 3 */
	attempts?: number;
	/** Base delay in ms — doubles each retry (exponential backoff). Default: 300 */
	delay?: number;
}

export interface KibinClientConfig {
	baseUrl: string;
	/** Static headers or a function returning headers (sync or async). Called once per fetch attempt. */
	headers?:
		| Record<string, string>
		| (() => Record<string, string> | Promise<Record<string, string>>);
	/** Per-attempt timeout in ms. Uses `AbortSignal.timeout()` internally. */
	timeout?: number;
	/** AbortSignal to cancel all requests from this client. */
	signal?: AbortSignal;
	retry?: RetryConfig;
	interceptors?: ClientInterceptors;
}
