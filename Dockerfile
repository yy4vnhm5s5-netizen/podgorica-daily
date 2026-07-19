FROM node:22-alpine AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .
RUN pnpm run build

FROM dependencies AS scheduler

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY src ./src
COPY scripts/scheduler-entrypoint.sh /usr/local/bin/scheduler-entrypoint
RUN mkdir -p /app/.runtime/cache \
  && chown -R nextjs:nodejs /app/.runtime \
  && chmod 755 /usr/local/bin/scheduler-entrypoint

USER nextjs
ENV RUNTIME_DATA_DIR=/app/.runtime

ENTRYPOINT ["scheduler-entrypoint"]

FROM base AS runner

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && apk add --no-cache su-exec

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY scripts/runtime-entrypoint.sh /usr/local/bin/runtime-entrypoint
RUN chmod 755 /usr/local/bin/runtime-entrypoint

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV RUNTIME_DATA_DIR=/app/.runtime

ENTRYPOINT ["runtime-entrypoint"]
CMD ["node", "server.js"]
