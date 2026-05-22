import { client } from './kibin.js';

// Users
const users = await client.user.listUsers();
console.log('Users:', users);

const user = await client.user.getUser('1');
console.log('User #1:', user);

const newUser = await client.user.createUser({
	name: 'Charlie',
	email: 'charlie@example.com',
});
console.log('Created user:', newUser);

// Posts
const posts = await client.post.listPosts();
console.log('\nPosts:', posts);

const post = await client.post.getPost('1');
console.log('Post #1:', post);

const newPost = await client.post.createPost({
	title: 'RPC is great',
	body: 'No more REST boilerplate',
	authorId: newUser.id,
});
console.log('Created post:', newPost);
