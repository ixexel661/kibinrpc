import { ensureActionsSet } from './registry.js';

export function ServerAction() {
	return <This, Args extends unknown[], Return>(
		target: (this: This, ...args: Args) => Return,
		context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
	) => {
		context.addInitializer(function (this: This) {
			if (typeof context.name === 'symbol') return;
			ensureActionsSet(this as object).add(context.name);
		});
		return target;
	};
}
