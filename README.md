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

POST /api/rpc  →  [{ namespace, method, args }, ...]   (auto-batched)
               ←  [{ data, status }, ...]
```

Calls that happen concurrently (e.g. inside `Promise.all`) are automatically batched into a single HTTP request. No explicit batch API needed.

## Usage

### Server

Two ways to register actions — class decorators or plain functions:

```ts
import { ServerAction, defineActions, createRouter } from '@kibinrpc/server'

// Class-based
class UserActions {
  @ServerAction()
  async getUser(id: string): Promise<User> { ... }

  @ServerAction()
  async createUser(data: Omit<User, 'id'>): Promise<User> { ... }
}

// Functional
const postActions = defineActions({
  async listPosts(): Promise<Post[]> { ... },
  async createPost(data: Omit<Post, 'id'>): Promise<Post> { ... },
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
```

### Client

```ts
import { createKibinClient } from '@kibinrpc/client'
import type { AppRouter } from './server/router'

const client = createKibinClient<AppRouter>({ baseUrl: '/api/rpc' })

// Fully typed — return types inferred from the server
const user = await client.user.getUser('1')
const posts = await client.post.listPosts()

// Concurrent calls are automatically batched into one HTTP request
const [users, posts] = await Promise.all([
  client.user.listUsers(),
  client.post.listPosts(),
])
```

### Error handling

Throw `KibinError` on the server — it propagates to the client with code and message:

```ts
import { KibinError } from '@kibinrpc/server'

throw new KibinError('NOT_FOUND', 'User not found')
```

```ts
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

### Interceptors

```ts
// Server — runs for every call including batched ones
const router = createRouter({ user, post }, {
  beforeAction: ({ namespace, method }) => {
    console.log(`→ ${namespace}.${method}`)
  },
  onError: ({ error }) => {
    reportError(error)
  },
})

// Client
const client = createKibinClient<AppRouter>({
  baseUrl: '/api/rpc',
  interceptors: {
    request: (ctx) => ({
      ...ctx,
      args: [{ ...ctx.args[0], token: getToken() }],
    }),
    error: ({ error }) => {
      if (error.code === 'UNAUTHORIZED') redirect('/login')
      throw error
    },
  },
})
```

### Retry

Failed requests are automatically retried with exponential backoff:

```ts
const client = createKibinClient<AppRouter>({
  baseUrl: '/api/rpc',
  retry: {
    attempts: 3,   // default
    delay: 300,    // ms, doubles each retry
  },
})
```

## Examples

| Example | Description |
|---|---|
| [`examples/node`](./examples/node) | Minimal setup with vanilla `node:http` |
| [`examples/backend`](./examples/backend) | Hono server with interceptors |
| [`examples/frontend`](./examples/frontend) | React + Vite frontend |

```sh
pnpm example:node
pnpm example:backend  # then:
pnpm example:frontend
```

## Development

```sh
pnpm install
pnpm build       # build all packages
pnpm dev         # watch mode
pnpm check       # lint + format check
pnpm check:fix   # lint + format fix
```

## Roadmap

- [ ] Fastify adapter
- [ ] Testing utilities

## License

MIT — [ixexel661](https://github.com/ixexel661)
