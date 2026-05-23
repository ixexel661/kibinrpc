export class KibinError<Code extends string = string> extends Error {
	readonly code: Code;

	constructor(code: Code, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'KibinError';
		this.code = code;
	}
}

export function isKibinError<Code extends string = string>(
	error: unknown,
	code?: Code,
): error is KibinError<Code> {
	return error instanceof KibinError && (code === undefined || error.code === code);
}
