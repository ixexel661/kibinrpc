export const SERVER_ACTIONS_KEY = Symbol('serverActions');
export const FUNCTION_ACTION_KEY = Symbol('functionAction');

const EMPTY_SET: ReadonlySet<string> = new Set();

export function getRegisteredActions(instance: object): ReadonlySet<string> {
	return (Reflect.get(instance, SERVER_ACTIONS_KEY) as Set<string> | undefined) ?? EMPTY_SET;
}

export function ensureActionsSet(instance: object): Set<string> {
	let set = Reflect.get(instance, SERVER_ACTIONS_KEY) as Set<string> | undefined;
	if (!set) {
		set = new Set<string>();
		Reflect.set(instance, SERVER_ACTIONS_KEY, set);
	}
	return set;
}

export function isBrandedAction(fn: unknown): boolean {
	return typeof fn === 'function' && Reflect.get(fn, FUNCTION_ACTION_KEY) === true;
}
