# Floating Chat (Next.js 9) — serves /widget.js (the embeddable launcher every
# customer site loads) and the iframe page the launcher opens.
# Node is pinned to the version package.json declares in "engines".
FROM node:16.20.2-alpine AS builder
WORKDIR /app

# Install deps against the committed lockfile first so this layer caches.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:16.20.2-alpine AS app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts
COPY --from=builder /app/LICENSE /app/THIRD_PARTY_NOTICES.md ./

USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
