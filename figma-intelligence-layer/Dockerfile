FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# --- Production image ---
FROM node:20-slim

WORKDIR /app

# Production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --production && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV CLOUD_MODE=true
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/cloud-server.js"]
