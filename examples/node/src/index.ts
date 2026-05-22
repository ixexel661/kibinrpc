import { createServer } from 'node:http';
import { client } from './client/rpc.config.js';
import { router } from './server/router.js';

const PORT = 3000;

// Bridge node:http → Web Request/Response API → rpc handler
const server = createServer(async (req, res) => {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk);
	const body = Buffer.concat(chunks).toString();

	const request = new Request(`http://localhost:${PORT}${req.url ?? '/'}`, {
		method: req.method ?? 'GET',
		headers: req.headers as HeadersInit,
		body: body || undefined,
	});

	const response = await router.handler(request);
	const responseBody = await response.text();

	res.writeHead(response.status, { 'Content-Type': 'application/json' });
	res.end(responseBody);
});

server.listen(PORT, async () => {
	console.log(`RPC server running on http://localhost:${PORT}/api/rpc\n`);

	const users = await client.user.listUsers();
	console.log('client.user.listUsers()\n', users);

	const alice = await client.user.getUser('1');
	console.log('\nclient.user.getUser("1")\n', alice);

	const charlie = await client.user.createUser({ name: 'Charlie', email: 'charlie@example.com' });
	console.log('\nclient.user.createUser({ name: "Charlie", ... })\n', charlie);

	const updatedList = await client.user.listUsers();
	console.log('\nclient.user.listUsers() after create\n', updatedList);

	server.close();
	console.log('\nDone.');
});
