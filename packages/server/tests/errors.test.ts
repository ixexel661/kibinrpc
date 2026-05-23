import { describe, expect, it } from 'vitest';
import { KibinError } from '../src/errors.js';

describe('KibinError', () => {
	it('sets code, message and name', () => {
		const err = new KibinError('NOT_FOUND', 'User not found');
		expect(err.code).toBe('NOT_FOUND');
		expect(err.message).toBe('User not found');
		expect(err.name).toBe('KibinError');
	});

	it('is an instance of Error', () => {
		expect(new KibinError('X', 'y')).toBeInstanceOf(Error);
	});
});
