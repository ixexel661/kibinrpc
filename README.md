# kibinrpc

A lightweight, framework-agnostic TypeScript RPC library with end-to-end type safety. No code generation, no schema files — just TypeScript.

## Packages

| Package | Description |
|---|---|
| [`@kibinrpc/server`](./packages/server) | Server router and action registration |
| [`@kibinrpc/client`](./packages/client) | Type-safe fetch-based RPC client |

## How it works

Define server actions, create a router, and get a fully typed client — the client's method signatures are inferred directly from the server implementation.

```
POST /api/rpc  →  { namespace, method, args }
               ←  { data } | { error }
```

## Usage

### Server

Two ways to register actions — class decorators or plain functions:

```ts
// Class-based (decorator)
import { ServerAction, createRouter } from '@kibinrpc/server'

class UserActions {
  @ServerAction()
  async getUser(id: string): Promise<User> { ... }

  @ServerAction()
  async createUser(data: Omit<User, 'id'>): Promise<User> { ... }
}

// Functional
import { defineActions } from '@kibinrpc/server'

const postActions = defineActions({
  async getPost(id: string): Promise<Post> { ... },
  async listPosts(): Promise<Post[]> { ... },
})

export const router = createRouter({
  user: new UserActions(),
  post: postActions,
})

export type AppRouter = typeof router
```

Mount the handler in any framework that supports the Web `Request`/`Response` API:

```ts
// Hono
app.post('/api/rpc', (c) => router.handler(c.req.raw))

// Node.js (manual bridge)
const request = new Request(url, { method, headers, body })
const response = await router.handler(request)
```

### Client

```ts
import { createKibinClient } from '@kibinrpc/client'
import type { AppRouter } from './server/router'

const client = createKibinClient<AppRouter>({
  baseUrl: '/api/rpc',
})

// Fully typed — no manual type annotations needed
const user = await client.user.getUser('1')
const post = await client.post.listPosts()
```

### Error handling

```ts
import { KibinError, isKibinError } from '@kibinrpc/server'

// Throw on the server — propagates to the client with code and status
throw new KibinError('NOT_FOUND', 'User not found', 404)

// Catch on the client
import { isKibinError } from '@kibinrpc/client'

try {
  await client.user.getUser('999')
} catch (err) {
  if (isKibinError(err)) {
    console.log(err.code)    // 'NOT_FOUND'
    console.log(err.message) // 'User not found'
  }
}
```

## Examples

| Example | Description |
|---|---|
| [`examples/node`](./examples/node) | Minimal setup with vanilla `node:http` |
| [`examples/backend`](./examples/backend) | Hono server |
| [`examples/frontend`](./examples/frontend) | React + Vite frontend |

Run an example:

```sh
pnpm example:node
pnpm example:backend
pnpm example:frontend
```

## Development

```sh
pnpm install
pnpm build       # build all packages
pnpm dev         # watch mode for all packages
pnpm check       # lint + format check
pnpm check:fix   # lint + format fix
```

## Roadmap

- [ ] Fastify adapter
- [ ] Testing utilities

## License

MIT — [ixexel661](https://github.com/ixexel661)
