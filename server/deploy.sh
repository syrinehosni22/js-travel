#!/usr/bin/env bash
# Met à jour et redémarre l'API.
#   cd server && ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

git pull || true
npm install --omit=dev
mkdir -p logs uploads
if pm2 describe js-travel-api > /dev/null 2>&1; then pm2 restart js-travel-api --update-env; else pm2 start ecosystem.config.cjs; fi
pm2 save
sleep 3
curl -fsS http://127.0.0.1:4000/api/health && echo && echo "✓ API en ligne" || { echo "✗ L'API ne répond pas : pm2 logs js-travel-api"; exit 1; }
