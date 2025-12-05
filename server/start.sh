#!/bin/sh
set -e

echo "Running deploy script..."
node scripts/deploy.js

echo "Starting server..."
exec node index.js
