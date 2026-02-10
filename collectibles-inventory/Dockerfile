# # Build stage
# FROM node:20-alpine AS builder
# WORKDIR /app

# # Copy package.json and install dependencies
# COPY package*.json ./
# RUN npm ci

# # Copy all files
# COPY . .

# # Build the Next.js app
# ENV NODE_ENV=production
# RUN npm run build

# # Production stage
# FROM node:20-alpine
# WORKDIR /app

# # Copy built assets from the builder stage
# COPY --from=builder /app/.next ./.next
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/public ./public
# COPY --from=builder /app/package*.json ./

# # Copy entrypoint script
# COPY entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh

# # Set environment variables
# ENV NODE_ENV=production
# ENV PORT=8080
# ENV API_BASE_URL=https://www.conejocoin.net


# # Expose port
# EXPOSE 8080

# # Use entrypoint script to start the app
# ENTRYPOINT ["/entrypoint.sh"]






# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all files
COPY . .

# Build the Next.js app
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app

# Copy built assets from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV API_BASE_URL=https://www.conejocoin.net

# Expose port
EXPOSE 8080

# Use CMD directly - NO ENTRYPOINT
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "8080"]