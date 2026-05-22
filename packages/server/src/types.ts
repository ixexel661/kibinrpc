export interface RpcRequest {
	namespace: string;
	method: string;
	args: unknown[];
}

export interface RpcResponse<T = unknown> {
	data?: T;
	error?: { code: string; message: string };
}
