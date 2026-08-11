# Pruebas María 2.0 — Production Dockerfile

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm exec prisma generate

# Build Next.js application
RUN pnpm run build

# Prune dependencies for production
RUN pnpm prune --prod

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user (security best practice)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Start application with dumb-init for signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/.bin/next", "start"]
