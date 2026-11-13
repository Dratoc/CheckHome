#!/usr/bin/env bash
# Arma checkhome-api.zip para App Service: código, package.json y lock, y las migraciones.
# Sin node_modules: App Service instala dependencias al desplegar (SCM_DO_BUILD_DURING_DEPLOYMENT=true).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .package checkhome-api.zip
mkdir -p .package/migrations
cp -R src scripts package.json package-lock.json .package/
cp ../db/migrations/*.sql .package/migrations/
(cd .package && zip -qr ../checkhome-api.zip .)
rm -rf .package
echo "Listo: $(pwd)/checkhome-api.zip"
