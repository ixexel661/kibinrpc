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

	it('with code: returns true when code matches', () => {
		const err = new KibinError('NOT_FOUND', 'missing');
		expect(isKibinError(err, 'NOT_FOUND')).toBe(true);
	});

	it('with code: returns false when code does not match', () => {
		const err = new KibinError('NOT_FOUND', 'missing');
		expect(isKibinError(err, 'FORBIDDEN')).toBe(false);
	});

	it('with code: returns false for non-KibinError', () => {
		expect(isKibinError(new Error('oops'), 'NOT_FOUND')).toBe(false);
	});
});

describe('KibinError generic', () => {
	it('infers code type from constructor argument', () => {
		const err = new KibinError('NOT_FOUND', 'missing');
		// runtime check — TypeScript infers err.code as 'NOT_FOUND'
		expect(err.code).toBe('NOT_FOUND');
	});

	it('preserves cause through Error options', () => {
		const cause = new Error('original');
		const err = new KibinError('INTERNAL_ERROR', 'wrapped', { cause });
		expect(err.cause).toBe(cause);
	});
});
