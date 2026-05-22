import { KibinError } from './errors.js';
import { getRegisteredActions, isBrandedAction } from './registry.js';
import type { RouterInterceptors, RpcRequest, RpcResponse } from './types.js';

type Services = Record<string, object>;

function jsonResponse(body: RpcResponse, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export function createRouter<T extends Services>(services: T, interceptors?: RouterInterceptors) {
	async function handler(request: Request): Promise<Response> {
		let body: RpcRequest;
		try {
			body = (await request.json()) as RpcRequest;
		} catch {
			return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }, 400);
		}

		const { namespace, method, args } = body;

		const service = services[namespace];
		if (!service) {
			return jsonResponse(
				{ error: { code: 'NOT_FOUND', message: `Namespace "${namespace}" not found` } },
				404,
			);
		}

		const fn = (service as Record<string, unknown>)[method];
		const isAllowed = getRegisteredActions(service).has(method) || isBrandedAction(fn);
		if (!isAllowed) {
			return jsonResponse(
				{
					error: {
						code: 'METHOD_NOT_FOUND',
						message: `"${method}" is not a registered server action`,
					},
				},
				404,
			);
		}

		if (typeof fn !== 'function') {
			return jsonResponse(
				{ error: { code: 'METHOD_NOT_FOUND', message: `Method "${method}" not found` } },
				404,
			);
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

			return jsonResponse({ data: finalResult }, 200);
		} catch (error) {
			if (interceptors?.onError) {
				await interceptors.onError({ ...ctx, error });
			}

			if (error instanceof KibinError) {
				return jsonResponse(
					{ error: { code: error.code, message: error.message } },
					error.statusCode,
				);
			}
			return jsonResponse(
				{ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
				500,
			);
		}
	}

	return { services, handler };
}
