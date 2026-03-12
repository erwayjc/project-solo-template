FROM node:22-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code needed by the worker
COPY src/ ./src/
COPY worker/ ./worker/
COPY tsconfig.json ./

# Start the worker
CMD ["npx", "tsx", "worker/index.ts"]
