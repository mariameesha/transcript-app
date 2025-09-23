# ---------- Build stage ----------
FROM node:20 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Add missing express types (fix TS7016)
RUN npm install --save-dev @types/express

RUN npm run build-backend
RUN npm run build
