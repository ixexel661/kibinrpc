import { SERVER_ACTIONS_KEY } from '../src/registry.js';

export function makeRequest(body: unknown): Request {
	return new Request('http://localhost/rpc', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export class SingleService {
	constructor() {
		Reflect.set(this, SERVER_ACTIONS_KEY, new Set(['doSomething']));
	}

	doSomething() {
		return 42;
	}

	notRegistered() {
		return 'private';
	}
}

export class MultiService {
	constructor() {
		Reflect.set(this, SERVER_ACTIONS_KEY, new Set(['a', 'b']));
	}

	a() {}
	b() {}
	c() {}
}
