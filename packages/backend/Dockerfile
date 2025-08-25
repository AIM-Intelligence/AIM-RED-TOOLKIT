FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install minimal OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git tini procps \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source (excluding projects folder via .dockerignore)
COPY . /app

# Create necessary directories
RUN mkdir -p /app/projects && \
    echo "[]" > /app/projects/projects.json && \
    chmod -R 755 /app/projects

# Set volumes for persistence
VOLUME ["/app/projects"]

EXPOSE 8000

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run without hot reload by default
# For development with hot reload, override with: docker run -e DISABLE_RELOAD=false ...
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]