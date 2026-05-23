import { SERVER_ACTIONS_KEY } from './registry.js';

export function ServerAction() {
	return <This, Args extends unknown[], Return>(
		target: (this: This, ...args: Args) => Return,
		context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
	) => {
		context.addInitializer(function (this: This) {
			if (typeof context.name === 'symbol') return;
			if (!Reflect.has(this as object, SERVER_ACTIONS_KEY)) {
				Reflect.set(this as object, SERVER_ACTIONS_KEY, new Set<string>());
			}
			(Reflect.get(this as object, SERVER_ACTIONS_KEY) as Set<string>).add(context.name);
		});
		return target;
	};
}
