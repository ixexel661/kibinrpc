FROM node:26-alpine AS base
RUN corepack enable

# Install dependencies
FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/docs/package.json ./apps/docs/package.json
RUN pnpm install --frozen-lockfile --filter=docs...

# Build
FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/docs/node_modules ./apps/docs/node_modules
COPY --from=deps /repo/apps/docs/.source ./apps/docs/.source
COPY apps/docs ./apps/docs
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter=docs run build

# Run
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/docs/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/docs/public ./apps/docs/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/docs/server.js"]
