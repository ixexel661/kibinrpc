# @kibinrpc/client

Type-safe fetch client for [kibinrpc](../../README.md) — fully inferred from your server router, with automatic batching, retry, and interceptors.

## Installation

```sh
npm install @kibinrpc/client
```

## Quick start

```ts
import { createKibinClient } from "@kibinrpc/client"
import type { AppRouter } from "./server/router"

const client = createKibinClient<AppRouter>({
  baseUrl: "/api/rpc",
})

// Return types are inferred from the server — no manual annotations
const user = await client.user.getUser("1")
const posts = await client.post.listPosts()
```

## Automatic batching

Concurrent calls are automatically coalesced into a single HTTP request:

```ts
// Both calls happen in the same tick → sent as one batched request
const [users, posts] = await Promise.all([
  client.user.listUsers(),
  client.post.listPosts(),
])

// Sequential calls → two separate requests
const user = await client.user.getUser("1")
const posts = await client.post.listPosts()
```

No configuration required. The server receives either a single object or an array — it handles both automatically.

## Configuration

```ts
const client = createKibinClient<AppRouter>({
  baseUrl: "/api/rpc",

  // Static headers sent with every request
  headers: {
    "X-App-Version": "1.0.0",
  },

  // Retry on network errors and 5xx responses
  retry: {
    attempts: 3,   // total attempts (default: 3)
    delay: 300,    // base delay in ms, doubles each retry (default: 300)
  },

  interceptors: {
    request: (ctx) => ctx,
    response: (ctx) => ctx.data,
    error: (ctx) => { throw ctx.error },
  },
})
```

## Interceptors

### `request`

Runs before every call. Use it to attach auth tokens or modify arguments:

```ts
interceptors: {
  request(ctx) {
    return { ...ctx, args: [{ ...ctx.args[0], token: getToken() }] }
  },
}
```

### `response`

Runs after every successful call. Use it to transform or log responses:

```ts
interceptors: {
  response({ namespace, method, data }) {
    console.log(`← ${namespace}.${method}`, data)
    return data
  },
}
```

### `error`

Runs on every failed call (after retries are exhausted). Return a fallback value or rethrow:

```ts
interceptors: {
  error({ error }) {
    if (error.code === "UNAUTHORIZED") {
      window.location.href = "/login"
    }
    throw error
  },
}
```

## Error handling

```ts
import { isKibinError } from "@kibinrpc/client"

try {
  await client.user.getUser("999")
} catch (err) {
  if (isKibinError(err)) {
    console.log(err.code)    // e.g. "NOT_FOUND"
    console.log(err.message) // e.g. "User not found"
  }
}
```

## Retry behaviour

| Scenario | Single call | Batched call |
|---|---|---|
| Network error | retry (all attempts) | retry whole batch |
| HTTP 5xx | retry (all attempts) | retry only failed items |
| HTTP 4xx | no retry, throw immediately | no retry, reject that item |

## API

### `createKibinClient<Router>(config)`

Returns a typed proxy. Every namespace from your router becomes a property, every registered action becomes an async method.

```ts
const client = createKibinClient<AppRouter>({ baseUrl: "/api/rpc" })

client.user.getUser("1")        // Promise<User>
client.post.listPosts()         // Promise<Post[]>
```

### `isKibinError(err)`

Type guard for `KibinError`:

```ts
import { isKibinError, KibinError } from "@kibinrpc/client"

isKibinError(err) // err is KibinError
err.code          // string
err.message       // string
```

### Exported types

```ts
import type {
  KibinClient,
  KibinClientConfig,
  ClientInterceptors,
  RequestCtx,
  ResponseCtx,
  ErrorCtx,
  RetryConfig,
} from "@kibinrpc/client"
```

## Related packages

| Package | Description |
|---|---|
| [`@kibinrpc/server`](../server/README.md) | Server-side router and action decorators |
| [`@kibinrpc/tanstack-query`](../tanstack-query/README.md) | TanStack Query adapter — `queryOptions`, `mutationOptions`, and query key factories |
