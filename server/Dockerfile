# Multi-stage build for optimized Railway deployment
# Stage 1: Dependencies
FROM node:20-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# Stage 2: Production Runtime
FROM node:20-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies ONLY (much smaller)
RUN npm ci --only=production

# Install Prisma CLI for migrations
RUN npm install prisma

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy application code
COPY scripts ./scripts/
COPY index.js ./

EXPOSE 8080

# Run migrations then start
CMD ["sh", "-c", "node scripts/deploy.js && node index.js"]
