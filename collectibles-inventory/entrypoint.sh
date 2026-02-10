#!/bin/sh
set -e

# Print environment for debugging (excluding sensitive values)
echo "Starting application with environment:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "API_BASE_URL: $API_BASE_URL"

# Allow runtime override of API URL via environment variables
if [ -n "$RUNTIME_API_URL" ]; then
  echo "Overriding API_BASE_URL with RUNTIME_API_URL: $RUNTIME_API_URL"
  export API_BASE_URL=$RUNTIME_API_URL
  export NEXT_PUBLIC_API_BASE_URL=$RUNTIME_API_URL
fi

# Check if we need to wait for backend services
if [ "$WAIT_FOR_BACKEND" = "true" ] && [ -n "$API_BASE_URL" ]; then
  echo "Waiting for backend to be available at $API_BASE_URL..."
  
  # Extract host and port from API_BASE_URL
  HOST=$(echo $API_BASE_URL | sed -e 's|^[^/]*//||' -e 's|/.*$||' -e 's|:.*$||')
  PORT=$(echo $API_BASE_URL | sed -n 's|^.*:\([0-9]\+\).*$|\1|p')
  
  # Default to port 80 if not specified
  if [ -z "$PORT" ]; then
    if echo $API_BASE_URL | grep -q "^https"; then
      PORT=443
    else
      PORT=80
    fi
  fi
  
  echo "Checking connection to $HOST:$PORT..."
  
  # Try to connect to the backend
  RETRIES=10
  WAIT_SECONDS=5
  
  for i in $(seq 1 $RETRIES); do
    if nc -z -w 5 $HOST $PORT; then
      echo "Backend is available!"
      break
    fi
    
    if [ $i -eq $RETRIES ]; then
      echo "Backend is not available after $RETRIES retries. Starting anyway..."
    else
      echo "Backend not available yet. Waiting $WAIT_SECONDS seconds... (Attempt $i/$RETRIES)"
      sleep $WAIT_SECONDS
    fi
  done
fi

# Start the Next.js application
echo "Starting Next.js application..."
exec npm start -- -p ${PORT:-8080} -H 0.0.0.0
