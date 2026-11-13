#!/usr/bin/env bash
# Despliega web/ (página mínima) y api/ (Functions) a Azure Static Web Apps, plan Free.
# Uso: SWA_NAME=swa-checkhome-xxxx RG=rg-checkhome bash api/scripts/deploy-swa.sh
# El token de despliegue se pide a Azure en el momento y no se guarda ni se imprime.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${SWA_NAME:?Falta SWA_NAME}"; : "${RG:=rg-checkhome}"
rm -rf .swa-api && mkdir .swa-api
cp -R api/src api/host.json api/package.json api/package-lock.json .swa-api/
(cd .swa-api && npm ci --omit=dev --no-audit --no-fund >/dev/null)
TOKEN=$(az staticwebapp secrets list -n "$SWA_NAME" -g "$RG" --query properties.apiKey -o tsv)
npx --yes @azure/static-web-apps-cli@2 deploy ./web --api-location ./.swa-api --api-language node --api-version 20 \
  --deployment-token "$TOKEN" --env production
rm -rf .swa-api
