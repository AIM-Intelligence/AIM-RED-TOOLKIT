FROM python:3.11-slim

WORKDIR /app

# Install Node.js and pnpm
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/requirements.txt ./packages/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile
RUN pip install -r packages/backend/requirements.txt

# Copy application code
COPY . .

# Build frontend
RUN pnpm --filter frontend build

EXPOSE 8000 5173

CMD ["sh", "-c", "cd packages/backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000"]