# Use Node.js 18 LTS as base image
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    bash

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
EXPOSE 3003
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS deps
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S trip-service -u 1001

# Set working directory
WORKDIR /app

# Install production dependencies
COPY --from=deps --chown=trip-service:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=trip-service:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown -R trip-service:nodejs logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Switch to app user
USER trip-service

# Start application
CMD ["node", "src/app.js"]