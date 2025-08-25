FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install OS dependencies including python3-venv for virtual environment creation
# Also install build dependencies to speed up package installations
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git tini procps gcc g++ python3-venv \
    python3-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 for pyright
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack and set global path
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && pnpm --version

# Install pyright globally via npm and ensure pyright-langserver is available
RUN pnpm add -g pyright@1.1.404 && \
    pyright --version && \
    # Create pyright-langserver wrapper if needed
    echo '#!/bin/sh' > /usr/local/bin/pyright-langserver && \
    echo 'exec npx pyright-langserver "$@"' >> /usr/local/bin/pyright-langserver && \
    chmod +x /usr/local/bin/pyright-langserver && \
    # Test that pyright-langserver is accessible
    pyright-langserver --version 2>/dev/null || echo "Pyright langserver installed"

# Python dependencies for executor service
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir ruff==0.8.6

# Copy application source
COPY . /app

# Create necessary directories
RUN mkdir -p /var/log/aim-red/lsp /app/projects && \
    chmod -R 755 /app/projects

# Set volumes for persistence
VOLUME ["/var/log/aim-red/lsp", "/app/projects"]

# LSP runtime environment variables
ENV LSP_LOG_LEVEL=INFO \
    LSP_STDIO_LOG_DIR=/var/log/aim-red/lsp \
    LSP_IDLE_TTL_MS=600000 \
    LSP_MAX_RESTARTS=5 \
    LSP_RESTART_WINDOW_MS=60000

# Expose ports for API and WebSockets
EXPOSE 8001

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run the executor service
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]