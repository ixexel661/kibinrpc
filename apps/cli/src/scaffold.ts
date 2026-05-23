import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type TemplateId = 'backend' | 'frontend';

export interface ScaffoldOptions {
	name: string;
	templates: TemplateId[];
}

function write(root: string, path: string, content: string): void {
	const full = join(root, path);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, content, 'utf-8');
}

export function scaffold({ name, templates }: ScaffoldOptions): void {
	const hasBackend = templates.includes('backend');
	const hasFrontend = templates.includes('frontend');
	const root = join(process.cwd(), name);

	// package.json
	const deps: Record<string, string> = {};
	const devDeps: Record<string, string> = {
		typescript: 'latest',
	};

	if (hasBackend) deps['@kibinrpc/server'] = 'latest';
	if (hasFrontend) {
		deps['@kibinrpc/client'] = 'latest';
		deps.react = '^19';
		deps['react-dom'] = '^19';
		devDeps.vite = 'latest';
		devDeps['@vitejs/plugin-react'] = 'latest';
	}
	if (hasBackend && hasFrontend) {
		deps.hono = 'latest';
	}

	const scripts: Record<string, string> = {};
	if (hasBackend) scripts['dev:server'] = 'tsx --watch src/server/index.ts';
	if (hasFrontend) scripts['dev:client'] = 'vite';
	scripts.dev =
		hasBackend && hasFrontend
			? 'pnpm dev:server & pnpm dev:client'
			: hasBackend
				? 'pnpm dev:server'
				: 'pnpm dev:client';

	write(
		root,
		'package.json',
		JSON.stringify(
			{
				name,
				version: '0.1.0',
				private: true,
				type: 'module',
				scripts,
				dependencies: deps,
				devDependencies: devDeps,
			},
			null,
			2,
		),
	);

	// tsconfig.json
	write(
		root,
		'tsconfig.json',
		JSON.stringify(
			{
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					strict: true,
					skipLibCheck: true,
					...(hasFrontend ? { jsx: 'react-jsx' } : {}),
				},
				include: ['src'],
			},
			null,
			2,
		),
	);

	// Backend
	if (hasBackend) {
		write(
			root,
			'src/server/router.ts',
			`import { createRouter, defineActions, KibinError } from '@kibinrpc/server'

const userActions = defineActions({
  async getUser(id: string) {
    // TODO: fetch from database
    throw new KibinError('NOT_FOUND', 'User not found')
  },
})

export const router = createRouter({ user: userActions })
export type AppRouter = typeof router
`,
		);

		const port = hasFrontend ? 3001 : 3000;
		write(
			root,
			'src/server/index.ts',
			`import { router } from './router.js'
${hasFrontend ? "import { Hono } from 'hono'\nimport { serve } from '@hono/node-server'" : ''}

${
	hasFrontend
		? `const app = new Hono()

app.post('/api/rpc', (c) => router.handler(c.req.raw))

serve({ fetch: app.fetch, port: ${port} }, () => {
  console.log('Server running on http://localhost:${port}')
})`
		: `import { createServer } from 'node:http'

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', \`http://\${req.headers.host}\`)
  if (url.pathname === '/api/rpc' && req.method === 'POST') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()
    const request = new Request(\`http://localhost:${port}\${url.pathname}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const response = await router.handler(request)
    res.writeHead(response.status, { 'Content-Type': 'application/json' })
    res.end(await response.text())
  } else {
    res.writeHead(404)
    res.end()
  }
})

server.listen(${port}, () => console.log('Server running on http://localhost:${port}'))`
}
`,
		);
	}

	// Frontend
	if (hasFrontend) {
		const rpcUrl = hasBackend ? "'http://localhost:3001/api/rpc'" : "'/api/rpc'";

		write(
			root,
			'src/client/main.tsx',
			`import { createRoot } from 'react-dom/client'
import { createKibinClient } from '@kibinrpc/client'
${hasBackend ? "import type { AppRouter } from '../server/router.js'" : ''}

const client = createKibinClient${hasBackend ? '<AppRouter>' : ''}({ baseUrl: ${rpcUrl} })

function App() {
  return <h1>Hello from kibinrpc!</h1>
}

createRoot(document.getElementById('root')!).render(<App />)
`,
		);

		write(
			root,
			'index.html',
			`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
`,
		);

		write(
			root,
			'vite.config.ts',
			`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],${hasBackend ? `\n  server: { proxy: { '/api': 'http://localhost:3001' } },` : ''}
})
`,
		);
	}

	// README
	const parts = [hasBackend && 'backend', hasFrontend && 'frontend'].filter(Boolean);
	write(
		root,
		'README.md',
		`# ${name}

A kibinrpc project with ${parts.join(' + ')}.

## Getting started

\`\`\`sh
pnpm install
pnpm dev
\`\`\`
`,
	);
}
