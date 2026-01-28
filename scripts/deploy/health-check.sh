#!/bin/bash
#
# Health Check Script for SNS Marketing Platform
# Usage: ./health-check.sh [URL] [MAX_RETRIES] [RETRY_INTERVAL]
#

set -e

URL="${1:-http://localhost:3000/api/trpc/health}"
MAX_RETRIES="${2:-30}"
RETRY_INTERVAL="${3:-5}"

echo "Starting health check..."
echo "URL: $URL"
echo "Max retries: $MAX_RETRIES"
echo "Retry interval: ${RETRY_INTERVAL}s"
echo ""

retry_count=0

while [ $retry_count -lt $MAX_RETRIES ]; do
    retry_count=$((retry_count + 1))
    echo "Attempt $retry_count/$MAX_RETRIES..."

    # Try to get health endpoint
    response=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
        echo ""
        echo "Health check PASSED!"

        # Get full response for logging
        full_response=$(curl -s "$URL" 2>/dev/null || echo "{}")
        echo "Response: $full_response"

        exit 0
    else
        echo "Health check failed with HTTP status: $response"

        if [ $retry_count -lt $MAX_RETRIES ]; then
            echo "Retrying in ${RETRY_INTERVAL}s..."
            sleep $RETRY_INTERVAL
        fi
    fi
done

echo ""
echo "Health check FAILED after $MAX_RETRIES attempts!"
echo ""

# Output container logs for debugging
echo "=== Container Logs ==="
docker compose -f docker-compose.prod.yml logs --tail=50 app 2>/dev/null || true

exit 1
