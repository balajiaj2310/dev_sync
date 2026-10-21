# ==============================================================================
# Multi-Stage Production Dockerfile for DevSync Backend
# ==============================================================================

# Build stage
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /install

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /install/
RUN pip install --upgrade pip \
    && pip install --prefix=/install/deps --no-cache-dir -r requirements.txt

# Final production runtime stage
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=devsync.settings.prod \
    PORT=8000

# Install runtime PostgreSQL client libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user
RUN groupadd -r devsync && useradd -r -g devsync -d /app -s /sbin/nologin devsync

WORKDIR /app

# Copy installed python dependencies from builder
COPY --from=builder /install/deps /usr/local

# Copy application source code
COPY --chown=devsync:devsync . /app

# Create persistent media and static directories
RUN mkdir -p /app/media /app/staticfiles && chown -R devsync:devsync /app/media /app/staticfiles

USER devsync

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/api/schema/ || exit 1

# Start Daphne ASGI server supporting both HTTP and WebSockets
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "devsync.asgi:application"]
