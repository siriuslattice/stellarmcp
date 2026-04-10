# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Install all dependencies (including dev deps for build)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY tsconfig.json tsup.config.ts ./
COPY src/ src/
RUN pnpm build

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# System deps for healthcheck
RUN apk add --no-cache wget

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# Copy built artifacts and runtime static files
COPY --from=builder /app/dist ./dist
COPY openapi.yaml skill.md ./

# Defaults — override at runtime via -e or --env-file
ENV NODE_ENV=production
ENV TRANSPORT=http
ENV STELLAR_NETWORK=pubnet
ENV PORT=4021
ENV HOST=0.0.0.0
ENV LOG_LEVEL=info

EXPOSE 4021

# Health check — tests the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://localhost:4021/health || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S stellarmcp && \
    adduser -S stellarmcp -u 1001 -G stellarmcp && \
    chown -R stellarmcp:stellarmcp /app
USER stellarmcp

CMD ["node", "dist/index.js"]
