# Use an official Python image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Workdir at the repo root or backend root; adjust so manage.py is here
WORKDIR /app

# System deps
# System deps (add to your existing apt-get line)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev netcat-traditional \
    libzbar0 \
    libglib2.0-0 libgl1 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .

# RUN pip install --no-cache-dir django-pgvector==0.2.0
RUN pip install --no-cache-dir pgvector==0.2.5
RUN pip install --no-cache-dir -r requirements.txt

# App code (copies the "backend" folder contents into /app)
COPY . .

# Build-time safe envs so settings can import
ENV USE_SQLITE_FOR_BUILD=true
ENV DJANGO_SECRET_KEY=build-placeholder

# Entry script
COPY ./entrypoint.sh /entrypoint.sh
# Fix potential CRLF + make executable
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Start
CMD ["/entrypoint.sh"]
