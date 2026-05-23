export interface RpcRequest {
	namespace: string;
	method: string;
	args: unknown[];
}

export interface RpcResponse<T = unknown> {
	data?: T;
	error?: { code: string; message: string };
}

export interface RpcBatchItemResponse extends RpcResponse {
	status: number;
}

export interface ActionCtx {
	namespace: string;
	method: string;
	args: unknown[];
	request: Request;
}

export interface AfterActionCtx extends ActionCtx {
	result: unknown;
}

export interface ActionErrorCtx extends ActionCtx {
	error: unknown;
}

export interface RouterInterceptors {
	beforeAction?: (ctx: ActionCtx) => void | Promise<void>;
	afterAction?: (ctx: AfterActionCtx) => unknown | Promise<unknown>;
	onError?: (ctx: ActionErrorCtx) => void | Promise<void>;
}
