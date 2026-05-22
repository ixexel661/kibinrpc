export const SERVER_ACTIONS_KEY = Symbol('serverActions');
export const FUNCTION_ACTION_KEY = Symbol('functionAction');

export function getRegisteredActions(instance: object): Set<string> {
	return (Reflect.get(instance, SERVER_ACTIONS_KEY) as Set<string> | undefined) ?? new Set();
}

export function isBrandedAction(fn: unknown): boolean {
	return typeof fn === 'function' && Reflect.get(fn, FUNCTION_ACTION_KEY) === true;
}
