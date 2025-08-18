FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY packages/frontend ./packages/frontend

# Expose port
EXPOSE 5173

# Start development server
CMD ["pnpm", "--filter", "frontend", "dev", "--host", "0.0.0.0"]