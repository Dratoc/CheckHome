#!/usr/bin/env bash
# Presupuesto de USD 1 al mes para toda la suscripción, con avisos al 50 %, 80 % y 100 % (real) y al 100 %
# (pronosticado). Crear un presupuesto no cobra. Correo: el de la cuenta con la que se hizo az login.
set -euo pipefail
SUB=$(az account show --query id -o tsv)
EMAIL=${1:-$(az account show --query user.name -o tsv)}
START=$(date -u +%Y-%m-01)
notif() { # $1 umbral, $2 Actual|Forecasted
  printf '"aviso-%s-%s": {"enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": %s, "thresholdType": "%s", "contactEmails": ["%s"]}' "$1" "$2" "$1" "$2" "$EMAIL"
}
BODY=$(cat <<JSON
{"properties": {
  "category": "Cost", "amount": 1, "timeGrain": "Monthly",
  "timePeriod": {"startDate": "${START}T00:00:00Z", "endDate": "2027-12-31T00:00:00Z"},
  "notifications": { $(notif 50 Actual), $(notif 80 Actual), $(notif 100 Actual), $(notif 100 Forecasted) }
}}
JSON
)
az rest --method put \
  --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Consumption/budgets/presupuesto-checkhome?api-version=2023-05-01" \
  --body "$BODY" --query "{nombre:name, monto:properties.amount}" -o table
