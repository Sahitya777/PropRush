# Production Dockerfile for Google Cloud Run
FROM node:20-slim

WORKDIR /app

# Copy dependency manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Build Vite client assets and compile server entrypoint
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
