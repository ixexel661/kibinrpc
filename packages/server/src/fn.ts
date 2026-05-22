import { FUNCTION_ACTION_KEY } from './registry.js';

export function serverAction<T extends (...args: never[]) => unknown>(fn: T): T {
	Reflect.set(fn, FUNCTION_ACTION_KEY, true);
	return fn;
}

export function defineActions<T extends Record<string, (...args: never[]) => unknown>>(
	actions: T,
): T {
	for (const key of Object.keys(actions)) {
		serverAction(actions[key]);
	}
	return actions;
}
