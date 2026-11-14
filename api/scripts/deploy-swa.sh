#!/usr/bin/env bash
# Despliega la versión web de la app (app/, exportada con Expo) y api/ (Functions) a Azure Static Web Apps, plan Free.
# La web llama a la API en el mismo dominio (/api), así que no necesita CORS. web/ solo aporta staticwebapp.config.json.
# Uso: SWA_NAME=swa-checkhome-xxxx RG=rg-checkhome bash api/scripts/deploy-swa.sh
# El token de despliegue se pide a Azure en el momento y no se guarda ni se imprime.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${SWA_NAME:?Falta SWA_NAME}"; : "${RG:=rg-checkhome}"
rm -rf .swa-api .swa-web && mkdir .swa-api
(cd app && npm ci --no-audit --no-fund >/dev/null && rm -rf dist && EXPO_PUBLIC_API_URL=/api npx expo export --platform web >/dev/null)
cp -R app/dist .swa-web && cp web/staticwebapp.config.json .swa-web/
cp -R api/src api/host.json api/package.json api/package-lock.json .swa-api/
(cd .swa-api && npm ci --omit=dev --no-audit --no-fund >/dev/null)
TOKEN=$(az staticwebapp secrets list -n "$SWA_NAME" -g "$RG" --query properties.apiKey -o tsv)
npx --yes @azure/static-web-apps-cli@2 deploy ./.swa-web --api-location ./.swa-api --api-language node --api-version 20 \
  --deployment-token "$TOKEN" --env production
rm -rf .swa-api .swa-web
