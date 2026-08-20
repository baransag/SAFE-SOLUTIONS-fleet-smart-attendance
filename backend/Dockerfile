# ===================================================
# Multi-Stage Production Dockerfile for SAFE SOLUTIONS Backend
# ===================================================

# 1. Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src/

RUN npx prisma generate
RUN npm run build

# 2. Production Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Create upload directory
RUN mkdir -p /app/uploads/selfies /app/uploads/meters /app/uploads/sites /app/uploads/fuel /app/uploads/maintenance /app/uploads/profiles

EXPOSE 5000

CMD ["node", "dist/server.js"]
