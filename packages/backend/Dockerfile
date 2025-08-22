FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git tini procps gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 for pyright
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack and set global path
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && pnpm --version

# Install pyright globally
RUN pnpm add -g pyright@1.1.404 && pyright --version

# Python dependencies (including ruff)
WORKDIR /app
COPY packages/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir ruff==0.8.6

# Copy application source
COPY packages/backend /app

# Create LSP and log directories
RUN mkdir -p /var/log/aim-red/lsp /app/projects

# Set volumes for persistence
VOLUME ["/var/log/aim-red/lsp", "/app/projects"]

# LSP runtime environment variables
ENV LSP_LOG_LEVEL=INFO \
    LSP_STDIO_LOG_DIR=/var/log/aim-red/lsp \
    LSP_IDLE_TTL_MS=600000 \
    LSP_MAX_RESTARTS=5 \
    LSP_RESTART_WINDOW_MS=60000

EXPOSE 8000

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]