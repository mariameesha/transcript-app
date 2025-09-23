# ---------- Build stage ----------
FROM node:20-bookworm AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build-backend

# ---------- Runtime stage ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/server.js"]

