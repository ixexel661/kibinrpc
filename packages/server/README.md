# @kibinrpc/server

Server router for [kibinrpc](../../README.md) — register actions, mount a single handler.

## Installation

```sh
npm install @kibinrpc/server
```

## Quick start

```ts
import { ServerAction, defineActions, createRouter, KibinError } from "@kibinrpc/server"

class UserActions {
  @ServerAction()
  async getUser(id: string) {
    const user = await db.users.find(id)
    if (!user) throw new KibinError("NOT_FOUND", "User not found")
    return user
  }
}

const postActions = defineActions({
  async listPosts() {
    return db.posts.findAll()
  },
})

export const router = createRouter({
  user: new UserActions(),
  post: postActions,
})

export type AppRouter = typeof router
```

Mount on any framework that supports the Web `Request`/`Response` API:

```ts
// Hono
app.post("/api/rpc", (c) => router.handler(c.req.raw))

// Next.js App Router
export const POST = router.handler
```

The handler automatically detects single vs. batched requests — no second endpoint needed.

## Registering actions

Only explicitly registered functions are callable. Everything else is rejected with `METHOD_NOT_FOUND`.

### Class decorator

```ts
import { ServerAction } from "@kibinrpc/server"

class UserActions {
  @ServerAction()
  async listUsers() { ... }

  // Not callable from the client — not decorated
  private helper() { ... }
}
```

### Functional

```ts
import { defineActions, serverAction } from "@kibinrpc/server"

// Register a whole namespace at once
const postActions = defineActions({
  async listPosts() { ... },
  async createPost(data: NewPost) { ... },
})

// Or mark individual functions
const deletePost = serverAction(async (id: string) => { ... })
```

## Interceptors

Interceptors run for every call — including each item inside a batched request.

```ts
const router = createRouter({ user, post }, {
  beforeAction({ namespace, method, args, request }) {
    const token = request.headers.get("Authorization")
    if (!token) throw new KibinError("UNAUTHORIZED", "Missing token")
  },

  afterAction({ namespace, method, result }) {
    return result // optionally transform the result
  },

  onError({ namespace, method, error }) {
    console.error(`[RPC] ${namespace}.${method} failed`, error)
  },
})
```

## Error handling

Throw `KibinError` to send a structured error to the client:

```ts
import { KibinError } from "@kibinrpc/server"

throw new KibinError("NOT_FOUND", "User not found")
throw new KibinError("UNAUTHORIZED", "Invalid token")
throw new KibinError("BAD_REQUEST", "Invalid input")
```

Any other thrown error becomes `{ code: 'INTERNAL_ERROR' }` — the original message is not leaked.

## HTTP status codes

| Error code | HTTP status |
|---|---|
| `NOT_FOUND`, `METHOD_NOT_FOUND` | 404 |
| `BAD_REQUEST` | 400 |
| everything else | 500 |

For batched requests, each item carries its own `status` field. The overall HTTP status is `200` if all items succeed, `207 Multi-Status` for partial failures.

## API

### `createRouter(services, interceptors?)`

```ts
const router = createRouter(
  { user: new UserActions(), post: postActions },
  { beforeAction, afterAction, onError },
)

router.handler // (request: Request) => Promise<Response>
router.services // the original services object
```

### `KibinError`

```ts
new KibinError(code: string, message: string)
```

### Exported types

```ts
import type {
  RouterInterceptors,
  ActionCtx,
  AfterActionCtx,
  ActionErrorCtx,
  RpcRequest,
  RpcResponse,
  RpcBatchItemResponse,
} from "@kibinrpc/server"
```

## Related packages

| Package | Description |
|---|---|
| [`@kibinrpc/client`](../client/README.md) | Type-safe fetch client with automatic batching and retry |
| [`@kibinrpc/tanstack-query`](../tanstack-query/README.md) | TanStack Query adapter — `queryOptions`, `mutationOptions`, and query key factories |
