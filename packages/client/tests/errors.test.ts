import { describe, expect, it } from 'vitest';
import { isKibinError, KibinError } from '../src/errors.js';

describe('KibinError', () => {
	it('sets code, message and name', () => {
		const err = new KibinError('NOT_FOUND', 'missing');
		expect(err.code).toBe('NOT_FOUND');
		expect(err.message).toBe('missing');
		expect(err.name).toBe('KibinError');
	});

	it('is an instance of Error', () => {
		expect(new KibinError('X', 'y')).toBeInstanceOf(Error);
	});
});

describe('isKibinError', () => {
	it('returns true for KibinError', () => {
		expect(isKibinError(new KibinError('X', 'y'))).toBe(true);
	});

	it('returns false for plain Error', () => {
		expect(isKibinError(new Error('oops'))).toBe(false);
	});

	it('returns false for null', () => {
		expect(isKibinError(null)).toBe(false);
	});

	it('returns false for primitives', () => {
		expect(isKibinError('error')).toBe(false);
		expect(isKibinError(42)).toBe(false);
	});
});
