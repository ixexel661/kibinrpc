export class KibinError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = 'KibinError';
		this.code = code;
	}
}

export function isKibinError(error: unknown): error is KibinError {
	return error instanceof KibinError;
}
