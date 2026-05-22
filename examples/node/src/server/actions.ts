import { ServerAction } from '@kibinrpc/server';

export interface User {
	id: string;
	name: string;
	email: string;
}

export class UserActions {
	private users: User[] = [
		{ id: '1', name: 'Alice', email: 'alice@example.com' },
		{ id: '2', name: 'Bob', email: 'bob@example.com' },
	];

	@ServerAction()
	async getUser(id: string): Promise<User | null> {
		return this.users.find((u) => u.id === id) ?? null;
	}

	@ServerAction()
	async listUsers(): Promise<User[]> {
		return this.users;
	}

	@ServerAction()
	async createUser(data: Omit<User, 'id'>): Promise<User> {
		const user: User = { id: String(this.users.length + 1), ...data };
		this.users.push(user);
		return user;
	}
}
