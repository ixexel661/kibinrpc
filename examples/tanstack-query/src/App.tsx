import { isKibinError } from '@kibinrpc/client';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { type client, query, queryClient } from './kibin.js';

// ─── Types inferred from the server ──────────────────────────────────────────

type User = Awaited<ReturnType<typeof client.user.listUsers>>[number];
type Post = Awaited<ReturnType<typeof client.post.listPosts>>[number];

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<div
				style={{ fontFamily: 'sans-serif', maxWidth: 720, margin: '40px auto', padding: '0 24px' }}
			>
				<h1 style={{ marginBottom: 8 }}>RPC + TanStack Query</h1>
				<p style={{ color: '#666', marginBottom: 40 }}>
					Concurrent <code>listUsers</code> + <code>listPosts</code> are auto-batched into one HTTP
					request by kibinrpc. Mutations invalidate the relevant cache keys.
				</p>
				<UserSection />
				<PostSection />
			</div>
		</QueryClientProvider>
	);
}

// ─── Users ────────────────────────────────────────────────────────────────────

function UserSection() {
	const users = useQuery(query.user.listUsers.queryOptions([]));

	const createUser = useMutation(
		query.user.createUser.mutationOptions({
			// Invalidate all user queries so the list refreshes
			onSuccess: () => queryClient.invalidateQueries({ queryKey: query.user.queryKey() }),
		}),
	);

	function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		createUser.mutate([
			{
				name: fd.get('name') as string,
				email: fd.get('email') as string,
			},
		]);
		e.currentTarget.reset();
	}

	return (
		<section style={{ marginBottom: 48 }}>
			<h2>Users</h2>

			<QueryState query={users} renderItem={(u: User) => `${u.name} — ${u.email}`} />

			<form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
				<input name="name" placeholder="Name" required />
				<input name="email" placeholder="Email" required />
				<button type="submit" disabled={createUser.isPending}>
					{createUser.isPending ? 'Adding…' : 'Add User'}
				</button>
			</form>

			<MutationError error={createUser.error} />
		</section>
	);
}

// ─── Posts ────────────────────────────────────────────────────────────────────

function PostSection() {
	const posts = useQuery(query.post.listPosts.queryOptions([]));

	const createPost = useMutation(
		query.post.createPost.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries({ queryKey: query.post.queryKey() }),
		}),
	);

	function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		createPost.mutate([
			{
				title: fd.get('title') as string,
				body: fd.get('body') as string,
				authorId: fd.get('authorId') as string,
			},
		]);
		e.currentTarget.reset();
	}

	return (
		<section>
			<h2>Posts</h2>

			<QueryState
				query={posts}
				renderItem={(p: Post) => (
					<>
						<strong>{p.title}</strong> — {p.body}
					</>
				)}
			/>

			<form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
				<input name="title" placeholder="Title" required />
				<input name="body" placeholder="Body" required />
				<input name="authorId" placeholder="Author ID" required />
				<button type="submit" disabled={createPost.isPending}>
					{createPost.isPending ? 'Adding…' : 'Add Post'}
				</button>
			</form>

			<MutationError error={createPost.error} />
		</section>
	);
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function QueryState<T>({
	query: q,
	renderItem,
}: {
	query: ReturnType<typeof useQuery<T[]>>;
	renderItem: (item: T) => React.ReactNode;
}) {
	if (q.isLoading) return <p style={{ color: '#888' }}>Loading…</p>;
	if (q.isError) {
		const err = q.error;
		return (
			<p style={{ color: 'crimson' }}>
				{isKibinError(err) ? `${err.code}: ${err.message}` : 'Unexpected error'}
			</p>
		);
	}
	return (
		<ul>
			{q.data?.map((item, i) => (
				<li key={i}>{renderItem(item)}</li>
			))}
		</ul>
	);
}

function MutationError({ error }: { error: unknown }) {
	if (!error) return null;
	const msg = isKibinError(error) ? `${error.code}: ${error.message}` : 'Unexpected error';
	return <p style={{ color: 'crimson', marginTop: 8 }}>{msg}</p>;
}
