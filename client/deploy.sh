#!/usr/bin/env bash
# Met en ligne le front : compile client/ et le copie dans le dossier servi par Nginx.
#   cd client && ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
WEB_ROOT=${WEB_ROOT:-/var/www/js-travel}

git pull || true
npm install
npm run build
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "${WEB_ROOT:?}"/*
sudo cp -r dist/* "$WEB_ROOT"/
sudo chown -R www-data:www-data "$WEB_ROOT"
echo "✓ Front publié dans $WEB_ROOT"
