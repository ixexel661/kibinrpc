import { createKibinClient, isKibinError } from '@kibinrpc/client';
import { createRouter, defineActions, KibinError } from '@kibinrpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// In-memory data store
type User = { id: string; name: string; email: string };
type Post = { id: string; title: string; body: string; authorId: string };

let users: User[] = [
	{ id: '1', name: 'Alice', email: 'alice@example.com' },
	{ id: '2', name: 'Bob', email: 'bob@example.com' },
];
let posts: Post[] = [{ id: '1', title: 'Hello', body: 'World', authorId: '1' }];

const userActions = defineActions({
	listUsers: (): User[] => users,
	getUser: (id: string): User => {
		const user = users.find((u) => u.id === id);
		if (!user) throw new KibinError('NOT_FOUND', `User "${id}" not found`);
		return user;
	},
	createUser: (data: { name: string; email: string }): User => {
		const user: User = { id: String(users.length + 1), ...data };
		users.push(user);
		return user;
	},
});

const postActions = defineActions({
	listPosts: (): Post[] => posts,
	createPost: (data: { title: string; body: string; authorId: string }): Post => {
		const post: Post = { id: String(posts.length + 1), ...data };
		posts.push(post);
		return post;
	},
});

const router = createRouter({ user: userActions, post: postActions });
export type AppRouter = typeof router;

// Wire the client directly to the router handler — no real HTTP
function makeHandlerFetch(handler: typeof router.handler) {
	return (url: string, init?: RequestInit) => handler(new Request(url, init));
}

afterEach(() => {
	users = [
		{ id: '1', name: 'Alice', email: 'alice@example.com' },
		{ id: '2', name: 'Bob', email: 'bob@example.com' },
	];
	posts = [{ id: '1', title: 'Hello', body: 'World', authorId: '1' }];
	vi.unstubAllGlobals();
});

function makeClient() {
	vi.stubGlobal('fetch', makeHandlerFetch(router.handler));
	return createKibinClient<AppRouter>({ baseUrl: 'http://localhost/rpc' });
}

describe('user CRUD', () => {
	it('listUsers returns all users', async () => {
		const client = makeClient();
		const result = await client.user.listUsers();
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('Alice');
	});

	it('getUser returns the correct user', async () => {
		const client = makeClient();
		const user = await client.user.getUser('2');
		expect(user.name).toBe('Bob');
	});

	it('createUser adds a user and returns it', async () => {
		const client = makeClient();
		const user = await client.user.createUser({ name: 'Charlie', email: 'charlie@example.com' });
		expect(user.name).toBe('Charlie');
		expect(user.id).toBeDefined();
		expect(await client.user.listUsers()).toHaveLength(3);
	});

	it('getUser throws KibinError NOT_FOUND for missing user', async () => {
		const client = makeClient();
		const err = await client.user.getUser('999').catch((e) => e);
		expect(isKibinError(err)).toBe(true);
		expect(err.code).toBe('NOT_FOUND');
	});
});

describe('post CRUD', () => {
	it('listPosts returns all posts', async () => {
		const client = makeClient();
		const result = await client.post.listPosts();
		expect(result).toHaveLength(1);
	});

	it('createPost adds a post', async () => {
		const client = makeClient();
		const post = await client.post.createPost({ title: 'New', body: 'Content', authorId: '1' });
		expect(post.title).toBe('New');
		expect(await client.post.listPosts()).toHaveLength(2);
	});
});

describe('auto-batching roundtrip', () => {
	it('Promise.all sends a single batch request', async () => {
		const fetch = vi.fn().mockImplementation(makeHandlerFetch(router.handler));
		vi.stubGlobal('fetch', fetch);
		const client = createKibinClient<AppRouter>({ baseUrl: 'http://localhost/rpc' });

		const [userList, postList] = await Promise.all([
			client.user.listUsers(),
			client.post.listPosts(),
		]);

		expect(fetch).toHaveBeenCalledOnce();
		const body = JSON.parse(fetch.mock.calls[0][1].body);
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(2);
		expect(userList).toHaveLength(2);
		expect(postList).toHaveLength(1);
	});
});
