import type { KibinError } from './errors.js';

type AsyncifyMethod<T> = T extends (...args: infer Args) => infer Return
	? (...args: Args) => Promise<Awaited<Return>>
	: never;

type ServiceClient<T> = {
	[K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: AsyncifyMethod<T[K]>;
};

type ExtractServices<T> = T extends { services: infer S } ? S : never;

export type KibinClient<Router> = {
	[K in keyof ExtractServices<Router>]: ServiceClient<ExtractServices<Router>[K]>;
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
	headers?: Record<string, string>;
	retry?: RetryConfig;
	interceptors?: ClientInterceptors;
}
