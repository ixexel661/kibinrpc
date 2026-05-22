import { KibinError } from './errors.js';
import { getRegisteredActions, isBrandedAction } from './registry.js';
import type { RouterInterceptors, RpcRequest, RpcResponse } from './types.js';

type Services = Record<string, object>;

function jsonResponse(body: RpcResponse | RpcResponse[], status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function statusFromResponse(result: RpcResponse): number {
	if (!result.error) return 200;
	if (result.error.code === 'NOT_FOUND' || result.error.code === 'METHOD_NOT_FOUND') return 404;
	if (result.error.code === 'BAD_REQUEST') return 400;
	return 500;
}

async function executeRpcCall(
	body: RpcRequest,
	request: Request,
	services: Services,
	interceptors: RouterInterceptors | undefined,
): Promise<RpcResponse> {
	const { namespace, method, args } = body;

	const service = services[namespace];
	if (!service) {
		return { error: { code: 'NOT_FOUND', message: `Namespace "${namespace}" not found` } };
	}

	const fn = (service as Record<string, unknown>)[method];
	const isAllowed = getRegisteredActions(service).has(method) || isBrandedAction(fn);
	if (!isAllowed) {
		return {
			error: {
				code: 'METHOD_NOT_FOUND',
				message: `"${method}" is not a registered server action`,
			},
		};
	}

	if (typeof fn !== 'function') {
		return { error: { code: 'METHOD_NOT_FOUND', message: `Method "${method}" not found` } };
	}

	const ctx = { namespace, method, args, request };

	try {
		if (interceptors?.beforeAction) {
			await interceptors.beforeAction(ctx);
		}

		const result = await fn.apply(service, args);

		let finalResult = result;
		if (interceptors?.afterAction) {
			const transformed = await interceptors.afterAction({ ...ctx, result });
			if (transformed !== undefined) finalResult = transformed;
		}

		return { data: finalResult };
	} catch (error) {
		if (interceptors?.onError) {
			await interceptors.onError({ ...ctx, error });
		}

		if (error instanceof KibinError) {
			return { error: { code: error.code, message: error.message } };
		}
		return { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };
	}
}

export function createRouter<T extends Services>(services: T, interceptors?: RouterInterceptors) {
	async function handler(request: Request): Promise<Response> {
		let body: RpcRequest;
		try {
			body = (await request.json()) as RpcRequest;
		} catch {
			return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }, 400);
		}

		const result = await executeRpcCall(body, request, services, interceptors);
		return jsonResponse(result, statusFromResponse(result));
	}

	async function batchHandler(request: Request): Promise<Response> {
		let bodies: RpcRequest[];
		try {
			bodies = (await request.json()) as RpcRequest[];
		} catch {
			return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }, 400);
		}

		const results = await Promise.all(
			bodies.map((body) => executeRpcCall(body, request, services, interceptors)),
		);
		return jsonResponse(results, 200);
	}

	return { services, handler, batchHandler };
}
