# Azure — recursos de CheckHome

Regla dura: **cero gasto**. Cuenta de prueba con límite de gasto, vence ~13 dic 2026. Nunca hacer "Upgrade".
Todos los recursos van en `rg-checkhome` con las etiquetas `proyecto=app-hogar` y `entorno=dev`.
La API corre en Static Web Apps Free ([ADR 0003](adr/0003-api-en-static-web-apps.md)); la prueba gratuita
no tiene cuota de App Service F1.

## Recursos

| Recurso | Nombre | SKU / plan | Por qué es gratis |
| --- | --- | --- | --- |
| Grupo de recursos | `rg-checkhome` | — | Los grupos no cobran |
| Presupuesto | `presupuesto-checkhome` | USD 1 al mes | Los presupuestos no cobran; avisan al 50 %, 80 % y 100 % |
| Static Web App (API) | `swa-checkhome-<sufijo>` | Free, Central US | Plan Free permanente, con Functions administradas incluidas |
| Servidor SQL lógico | `sql-checkhome-<sufijo>` | Central US | El servidor lógico no cobra |
| Base de datos | `checkhome` | Serverless GP_S_Gen5_2 con **oferta gratuita** | 100.000 vCore-segundos y 32 GB al mes; al agotarse se **pausa** hasta el mes siguiente (`AutoPause`), no cobra |

## Secretos

- Ninguna clave pasa por el repo ni por el chat.
- La clave del administrador SQL se genera en el momento, se usa una vez (migraciones y usuario de la API) y no
  se guarda: si hace falta otra vez se resetea con `az sql server update --admin-password`.
- La API se conecta con el usuario `checkhome_api`, con permisos solo de leer y escribir datos. Su cadena de
  conexión y la clave del JWT viven solo en la configuración de la Static Web App
  (`SQL_CONNECTION_STRING`, `JWT_SECRET`).

## Comandos (en el Mac de Hernan, con su `az login`)

```bash
RG=rg-checkhome; LOC=centralus; SFX=$(openssl rand -hex 3)
SWA=swa-checkhome-$SFX; SQL=sql-checkhome-$SFX; DB=checkhome
TAGS="proyecto=app-hogar entorno=dev"
```

1. Chequeo previo (solo lectura): `az account show` con `quotaId` FreeTrial y `spendingLimit: On`.
2. Grupo y presupuesto: `az group create -n $RG -l brazilsouth --tags $TAGS` y `bash infra/create-budget.sh`.
3. SQL:
   ```bash
   SQLPASS=$(openssl rand -base64 24)   # se queda en la terminal, no se imprime
   az sql server create -g $RG -n $SQL -l $LOC --admin-user checkhome_admin --admin-password "$SQLPASS"
   az sql db create -g $RG -s $SQL -n $DB --edition GeneralPurpose --compute-model Serverless \
     --family Gen5 --capacity 2 --use-free-limit --free-limit-exhaustion-behavior AutoPause \
     --backup-storage-redundancy Local --tags $TAGS
   az sql server firewall-rule create -g $RG -s $SQL -n azure-services --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
   az sql server firewall-rule create -g $RG -s $SQL -n mac-migraciones --start-ip-address <ip> --end-ip-address <ip>
   ```
4. Migraciones y usuario de la API (desde `api/`, con la conexión de administrador):
   `npm ci`, `npm run migrate` y `node scripts/create-api-user.js`. Después se borra la regla `mac-migraciones`.
5. Static Web App:
   ```bash
   az staticwebapp create -g $RG -n $SWA -l $LOC --sku Free --tags $TAGS
   az staticwebapp appsettings set -g $RG -n $SWA --setting-names \
     SQL_CONNECTION_STRING="<de create-api-user>" JWT_SECRET="$(openssl rand -base64 48)"
   ```
6. Despliegue: `PATH=/opt/homebrew/opt/node@22/bin:$PATH SWA_NAME=$SWA bash api/scripts/deploy-swa.sh`
   (la CLI de Static Web Apps necesita Node 22.12 o más nuevo; en el Mac está `node@22` de Homebrew aparte).
7. Prueba: `curl https://<host>/api/health` y `curl https://<host>/api/uf`.
8. La URL `https://<host>/api` queda en `.github/workflows/apk-prueba.yml` (o en la variable `API_URL` del repo).

## Estado actual (13 nov 2026)

- Static Web App `swa-checkhome-e20fee` (Free, Central US): https://purple-coast-025bebe10.8.azurestaticapps.net/api
- SQL `sql-checkhome-e20fee` / base `checkhome` (oferta gratuita, AutoPause), migraciones 0001 y 0002.
- Firewall: solo `azure-services`. Presupuesto `presupuesto-checkhome` USD 1.
- Probado: `/health` 200, `/uf` 200 (mindicador), registro 201, `/households` 200 con `X-CheckHome-Token`.

## Versión web para iPhone (PWA)

La misma Static Web App sirve la versión web de la app en la raíz (`https://<host>/`) y la API en `/api`.
`deploy-swa.sh` exporta `app/` con `npx expo export --platform web` (con `EXPO_PUBLIC_API_URL=/api`) y la sube
junto con la API. No crea recursos nuevos ni cambia el plan: sigue en Free. En el iPhone: abrir la URL en Safari →
Compartir → "Agregar a pantalla de inicio". La sesión se guarda en el almacenamiento del navegador.

## Antes del 13 dic 2026

La prueba vence y la suscripción se deshabilita. Lo gratis sigue gratis solo si la suscripción pasa a pago por
uso, y eso se decide aparte (ver decisión 8 de `docs/mvp.md`). Nunca se hace "Upgrade" sin esa decisión.
