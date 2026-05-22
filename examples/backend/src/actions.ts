import { defineActions, KibinError, ServerAction } from '@kibinrpc/server';

export interface User {
	id: string;
	name: string;
	email: string;
}

export interface Post {
	id: string;
	title: string;
	body: string;
	authorId: string;
}

export class UserActions {
	private users: User[] = [
		{ id: '1', name: 'Alice', email: 'alice@example.com' },
		{ id: '2', name: 'Bob', email: 'bob@example.com' },
	];

	@ServerAction()
	async getUser(id: string): Promise<User> {
		const user = this.users.find((u) => u.id === id);
		if (!user) throw new KibinError('NOT_FOUND', `User "${id}" not found`, 404);
		return user;
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

const posts: Post[] = [
	{ id: '1', title: 'Hello World', body: 'My first post', authorId: '1' },
	{ id: '2', title: 'TypeScript Tips', body: 'Use strict mode', authorId: '2' },
];

export const postActions = defineActions({
	async getPost(id: string): Promise<Post> {
		const post = posts.find((p) => p.id === id);
		if (!post) throw new KibinError('NOT_FOUND', `Post "${id}" not found`, 404);
		return post;
	},
	async listPosts(): Promise<Post[]> {
		return posts;
	},
	async createPost(data: Omit<Post, 'id'>): Promise<Post> {
		const post: Post = { id: String(posts.length + 1), ...data };
		posts.push(post);
		return post;
	},
});
