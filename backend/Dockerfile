# # Use an official Python image
# FROM python:3.12-slim

# ENV PYTHONDONTWRITEBYTECODE=1 \
#     PYTHONUNBUFFERED=1 \
#     PIP_NO_CACHE_DIR=1

# # Workdir at the repo root or backend root; adjust so manage.py is here
# WORKDIR /app

# # System deps
# # System deps (add to your existing apt-get line)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     gcc libpq-dev netcat-traditional \
#     libzbar0 \
#     libglib2.0-0 libgl1 libsm6 libxext6 libxrender1 \
#     && rm -rf /var/lib/apt/lists/*

# # Python deps
# COPY requirements.txt .

# # RUN pip install --no-cache-dir django-pgvector==0.2.0
# RUN pip install --no-cache-dir pgvector==0.2.5
# RUN pip install --no-cache-dir -r requirements.txt

# # App code (copies the "backend" folder contents into /app)
# COPY . .

# # Build-time safe envs so settings can import
# ENV USE_SQLITE_FOR_BUILD=true
# ENV DJANGO_SECRET_KEY=build-placeholder

# # Entry script
# COPY ./entrypoint.sh /entrypoint.sh
# # Fix potential CRLF + make executable
# RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# # Start the container
# CMD ["/entrypoint.sh"]

# =================================

# Use full Python image to get more disk space
FROM python:3.12

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev netcat-traditional \
    libzbar0 \
    libglib2.0-0 libgl1 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for caching)
COPY requirements.txt .

# Install heavy packages first (CPU-only)
RUN pip install --no-cache-dir torch==2.2.0+cpu triton numpy pgvector==0.2.5 --extra-index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Build-time envs
ENV USE_SQLITE_FOR_BUILD=true
ENV DJANGO_SECRET_KEY=build-placeholder

# Entrypoint
COPY ./entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]