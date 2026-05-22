import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { router } from './router.js';

const app = new Hono();

app.post('/api/rpc', (c) => router.handler(c.req.raw));
app.post('/api/rpc/batch', (c) => router.batchHandler(c.req.raw));

serve({ fetch: app.fetch, port: 3000 }, () => {
	console.log('Backend running on http://localhost:3000/api/rpc');
});
