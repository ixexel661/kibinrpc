import { useEffect, useState } from 'react';
import { client } from './kibin.js';

type User = Awaited<ReturnType<typeof client.user.listUsers>>[number];
type Post = Awaited<ReturnType<typeof client.post.listPosts>>[number];

export default function App() {
	const [users, setUsers] = useState<User[]>([]);
	const [posts, setPosts] = useState<Post[]>([]);

	useEffect(() => {
		client.user.listUsers().then(setUsers);
		client.post.listPosts().then(setPosts);
	}, []);

	async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		const user = await client.user.createUser({
			name: fd.get('name') as string,
			email: fd.get('email') as string,
		});
		setUsers((prev) => [...prev, user]);
		form.reset();
	}

	async function handleCreatePost(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		const post = await client.post.createPost({
			title: fd.get('title') as string,
			body: fd.get('body') as string,
			authorId: fd.get('authorId') as string,
		});
		setPosts((prev) => [...prev, post]);
		form.reset();
	}

	return (
		<div
			style={{
				fontFamily: 'sans-serif',
				maxWidth: 720,
				margin: '40px auto',
				padding: '0 24px',
			}}
		>
			<h1 style={{ marginBottom: 32 }}>RPC Demo</h1>

			<section style={{ marginBottom: 48 }}>
				<h2>Users</h2>
				<ul>
					{users.map((u) => (
						<li key={u.id}>
							<strong>{u.name}</strong> — {u.email}
						</li>
					))}
				</ul>
				<form onSubmit={handleCreateUser} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
					<input name="name" placeholder="Name" required />
					<input name="email" placeholder="Email" required />
					<button type="submit">Add User</button>
				</form>
			</section>

			<section>
				<h2>Posts</h2>
				<ul>
					{posts.map((p) => (
						<li key={p.id}>
							<strong>{p.title}</strong> — {p.body}
						</li>
					))}
				</ul>
				<form onSubmit={handleCreatePost} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
					<input name="title" placeholder="Title" required />
					<input name="body" placeholder="Body" required />
					<input name="authorId" placeholder="Author ID" required />
					<button type="submit">Add Post</button>
				</form>
			</section>
		</div>
	);
}
