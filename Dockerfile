FROM node:20-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/services/schema_financepro.sql ./src/services/schema_financepro.sql

# Cloud Run sets PORT (default 8080) and expects the container to listen on it.
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
