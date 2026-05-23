# docs

The kibinrpc documentation site — built with [Fumadocs](https://fumadocs.dev) on Next.js.

## Development

```sh
pnpm dev
```

Open http://localhost:3000.

## Content

Documentation lives in `content/docs/`. Each `.mdx` file maps to a route under `/docs/`.

| File | Route |
|---|---|
| `content/docs/getting-started.mdx` | `/docs/getting-started` |
| `content/docs/server.mdx` | `/docs/server` |
| `content/docs/client.mdx` | `/docs/client` |
| `content/docs/interceptors.mdx` | `/docs/interceptors` |
| `content/docs/error-handling.mdx` | `/docs/error-handling` |

## Build

```sh
pnpm build
```
