# Multi-stage Dockerfile for SweetHarvest
# Uses Node 22 Alpine (includes native node:sqlite support)

# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci || npm install
COPY backend/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# Install production dependencies for backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy compiled backend
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Copy built frontend assets (served by Express at /)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose HTTP port
EXPOSE 80

# Start SweetHarvest server
CMD ["node", "backend/dist/index.js"]
