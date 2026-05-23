# @kibinrpc/tanstack-query

TanStack Query (v5) adapter for [kibinrpc](../../README.md) — type-safe `queryOptions`, `mutationOptions`, and query key factories, fully inferred from your server router.

## Installation

```sh
npm install @kibinrpc/tanstack-query @kibinrpc/client @tanstack/react-query
```

## Quick start

```ts
// src/kibin.ts
import { createKibinClient } from '@kibinrpc/client'
import { createKibinQuery } from '@kibinrpc/tanstack-query'
import { QueryClient } from '@tanstack/react-query'
import type { AppRouter } from './server/router'

export const queryClient = new QueryClient()
export const client = createKibinClient<AppRouter>({ baseUrl: '/api/rpc' })
export const query = createKibinQuery(client)
```

```tsx
// In a component
import { useQuery, useMutation } from '@tanstack/react-query'
import { query, queryClient } from './kibin'

function UserList() {
  const users = useQuery(query.user.listUsers.queryOptions([]))

  const createUser = useMutation(
    query.user.createUser.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: query.user.queryKey() }),
    }),
  )

  return (
    <>
      <ul>{users.data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>
      <button onClick={() => createUser.mutate([{ name: 'Alice', email: 'alice@example.com' }])}>
        Add
      </button>
    </>
  )
}
```

## Query keys

Every namespace and method exposes a stable `queryKey()` factory. TanStack Query's prefix-matching means invalidating a broader key covers all narrower ones beneath it.

```ts
query.user.queryKey()                    // ['@kibinrpc', 'user']
query.user.getUser.queryKey()            // ['@kibinrpc', 'user', 'getUser']
query.user.getUser.queryKey(['user-1'])  // ['@kibinrpc', 'user', 'getUser', { args: ['user-1'] }]
```

```ts
// Invalidate all user queries
queryClient.invalidateQueries({ queryKey: query.user.queryKey() })

// Invalidate exactly one call
queryClient.invalidateQueries({ queryKey: query.user.getUser.queryKey(['user-1']) })
```

## Queries

`queryOptions` returns a fully-typed options object compatible with `useQuery`, `useSuspenseQuery`, `prefetchQuery`, `fetchQuery`, and `useQueries`.

```ts
// Basic
useQuery(query.post.listPosts.queryOptions([]))

// With overrides
useSuspenseQuery(query.user.getUser.queryOptions([id], { staleTime: 60_000 }))

// Parallel — auto-batched by kibinrpc into one HTTP request
useQueries({
  queries: [
    query.user.getUser.queryOptions(['1']),
    query.user.getUser.queryOptions(['2']),
  ],
})

// Prefetch in a route loader or server component
await queryClient.prefetchQuery(query.post.listPosts.queryOptions([]))
```

## Mutations

`mutationOptions` returns a fully-typed options object for `useMutation`. Arguments are passed as a tuple matching the server method's parameter list.

```ts
const createPost = useMutation(
  query.post.createPost.mutationOptions({
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: query.post.queryKey() }),
  }),
)

// args tuple — same order as the server method signature
createPost.mutate([{ title: 'Hello', body: 'World', authorId: '1' }])
```

## Configuration

```ts
// Change the query key prefix (default: '@kibinrpc')
const query = createKibinQuery(client, { queryKeyPrefix: 'myapp' })

query.user.queryKey() // ['myapp', 'user']
```

## Error handling

All query and mutation errors are typed as `KibinError`. Use `isKibinError` to narrow the type:

```ts
import { isKibinError } from '@kibinrpc/client'

if (isKibinError(error)) {
  console.log(error.code)    // e.g. 'NOT_FOUND', 'TIMEOUT'
  console.log(error.message)
}
```

## API

### `createKibinQuery(client, config?)`

| Parameter | Type | Description |
|---|---|---|
| `client` | `KibinClient<Router>` | The kibinrpc client to wrap |
| `config.queryKeyPrefix` | `string` | Prefix for all generated keys. Default: `'@kibinrpc'` |

### `KibinQueryProxy<Router>`

For every namespace `NS` and method `M`:

| Property | Description |
|---|---|
| `query[NS][M].queryOptions(args, options?)` | Options for `useQuery`, `useSuspenseQuery`, `prefetchQuery`, … |
| `query[NS][M].queryKey(args?)` | Call-level key (with args) or method-level key (without) |
| `query[NS][M].mutationOptions(options?)` | Options for `useMutation` |
| `query[NS][M].mutationKey()` | Stable key for devtools filtering |
| `query[NS].queryKey()` | Namespace-level key for broad invalidation |

### Exported types

```ts
import type {
  KibinQueryProxy,
  KibinQueryConfig,
  MethodUtils,
} from '@kibinrpc/tanstack-query'
```

## Known limitations

**TanStack Query's `signal` is not forwarded.** When a component unmounts, TQ passes an `AbortSignal` to `queryFn` to cancel the request — kibinrpc does not support per-call signals yet, so the underlying HTTP request will complete even if TQ discards the result. As a workaround, override `queryFn` manually:

```ts
query.user.listUsers.queryOptions([], {
  queryFn: ({ signal }) =>
    createKibinClient<AppRouter>({ baseUrl: '/api/rpc', signal }).user.listUsers(),
})
```

## Related packages

| Package | Description |
|---|---|
| [`@kibinrpc/server`](../server/README.md) | Server-side router and action decorators |
| [`@kibinrpc/client`](../client/README.md) | Type-safe fetch client with automatic batching and retry |
