#!/bin/sh
set -e

# Function to check if PostgreSQL is ready
pg_isready() {
  # For Cloud SQL with Unix socket (GCP production environment)
  if [ ! -z "${CLOUD_SQL_CONNECTION_NAME}" ]; then
    # When using Cloud SQL, we connect via Unix socket
    SOCKET_PATH="/cloudsql/${CLOUD_SQL_CONNECTION_NAME}"
    echo "[entrypoint] GCP Cloud SQL detected, checking connection at ${SOCKET_PATH}..."
    
    # Check if the socket directory exists
    if [ -d "${SOCKET_PATH}" ]; then
      echo "[entrypoint] Cloud SQL socket directory exists, connection is ready"
      return 0
    else
      echo "[entrypoint] ERROR: Cloud SQL socket directory not found at ${SOCKET_PATH}"
      echo "[entrypoint] This typically means the Cloud SQL Auth Proxy is not properly configured"
      echo "[entrypoint] Make sure your service account has proper permissions"
      return 1
    fi
  else
    # Local development environment
    echo "[entrypoint] No CLOUD_SQL_CONNECTION_NAME found, assuming local development"
    
    if [ -z "${DB_HOST}" ]; then
      echo "[entrypoint] WARNING: DB_HOST not set, using default localhost"
      DB_HOST="localhost"
    fi
    
    echo "[entrypoint] Checking if PostgreSQL at ${DB_HOST}:${DB_PORT:-5432} is ready..."
  fi
  
  # Use nc to check if the port is open
  for i in $(seq 1 30); do
    nc -z ${DB_HOST} ${DB_PORT} > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      echo "[entrypoint] PostgreSQL is ready!"
      return 0
    fi
    
    echo "[entrypoint] Waiting for PostgreSQL to become available... ${i}/30"
    sleep 2
  done
  
  echo "[entrypoint] Failed to connect to PostgreSQL after 30 attempts!"
  return 1
}

# Check for required database credentials
if [ -z "${DB_NAME}" ] || [ -z "${DB_USER}" ] || [ -z "${DB_PASSWORD}" ]; then
  echo "[entrypoint] WARNING: Database credentials not fully provided."
  echo "[entrypoint] Required: DB_NAME=${DB_NAME:-<missing>}, DB_USER=${DB_USER:-<missing>}, DB_PASSWORD=${DB_PASSWORD:-<missing>}"
  echo "[entrypoint] Migrations may fail due to missing credentials."
fi

echo "[entrypoint] Django check..."
python manage.py check || true

echo "[entrypoint] Waiting for PostgreSQL to become available..."
if pg_isready; then
  echo "[entrypoint] Database connection successful, running migrations..."
  echo "[entrypoint] Using database: ${DB_NAME} with user: ${DB_USER}"
  python manage.py migrate --noinput
  
  if [ $? -ne 0 ]; then
    echo "[entrypoint] WARNING: Migrations failed, but continuing startup"
    echo "[entrypoint] This could be due to incorrect database credentials or permissions"
  else
    echo "[entrypoint] Migrations completed successfully"
    
    # Initialize FAQ database if enabled
    if [ "${INIT_FAQS:-false}" = "true" ]; then
      echo "[entrypoint] Initializing FAQ database..."
      
      # First check if the enhanced_init_faqs command exists
      if python manage.py help enhanced_init_faqs > /dev/null 2>&1; then
        # Command exists, proceed with initialization
        if [ -n "${FAQ_FILE_PATH}" ] && [ -f "${FAQ_FILE_PATH}" ]; then
          echo "[entrypoint] Using custom FAQ file: ${FAQ_FILE_PATH}"
          python manage.py enhanced_init_faqs --file "${FAQ_FILE_PATH}"
        else
          echo "[entrypoint] Using built-in FAQs from enhanced_init_faqs.py"
          python manage.py enhanced_init_faqs
        fi
      elif python manage.py help init_faqs > /dev/null 2>&1; then
        # Fall back to original init_faqs if enhanced version doesn't exist
        echo "[entrypoint] enhanced_init_faqs not found, falling back to init_faqs"
        python manage.py init_faqs
      else
        echo "[entrypoint] WARNING: Neither enhanced_init_faqs nor init_faqs commands found"
        echo "[entrypoint] Make sure the file exists at backend/assistant/management/commands/enhanced_init_faqs.py"
        echo "[entrypoint] or backend/assistant/management/commands/init_faqs.py"
        return 1
      fi
      
      if [ $? -ne 0 ]; then
        echo "[entrypoint] WARNING: FAQ initialization failed, but continuing startup"
      else
        echo "[entrypoint] FAQ database initialized successfully"
      fi
    else
      echo "[entrypoint] Skipping FAQ initialization (set INIT_FAQS=true to enable)"
    fi
  fi
else
  echo "[entrypoint] WARNING: Database not available, skipping migrations"
  echo "[entrypoint] The application may not function correctly without migrations"
fi

echo "[entrypoint] collectstatic (non-fatal)…"
python manage.py collectstatic --noinput || echo "[entrypoint] collectstatic failed (continuing)"

echo "[entrypoint] Starting Gunicorn…"
exec gunicorn settings.wsgi:application \
  --bind 0.0.0.0:${PORT:-8080} \
  --workers ${WEB_CONCURRENCY:-1} \
  --threads ${WEB_THREADS:-2} \
  --timeout ${WEB_TIMEOUT:-240} \
  --graceful-timeout 60 \
  --max-requests 200 \
  --max-requests-jitter 50 \
  --access-logfile - \
  --error-logfile -
