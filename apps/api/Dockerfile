FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build stage
FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/evaluator/package.json packages/evaluator/
COPY prisma/ prisma/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/evaluator/ packages/evaluator/
COPY apps/api/ apps/api/
RUN pnpm --filter @feature-flags/evaluator build
RUN pnpm --filter @feature-flags/api build
RUN pnpm exec prisma generate --schema=prisma/schema.prisma

# Runtime stage
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/evaluator/dist ./packages/evaluator/dist
COPY --from=build /app/packages/evaluator/package.json ./packages/evaluator/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/package.json ./

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
