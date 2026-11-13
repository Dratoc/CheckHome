# Azure — recursos de CheckHome

Regla dura: **cero gasto**. Cuenta de prueba con límite de gasto, vence ~13 dic 2026. Nunca hacer "Upgrade".
Todos los recursos van en `rg-checkhome` con las etiquetas `proyecto=app-hogar` y `entorno=dev`.

## Recursos

| Recurso | Nombre | SKU / plan | Por qué es gratis |
| --- | --- | --- | --- |
| Grupo de recursos | `rg-checkhome` | — | Los grupos no cobran |
| Plan de App Service | `plan-checkhome` | F1 Linux | Nivel gratis permanente: 1 GB RAM, 60 min de CPU al día |
| App Service (API) | `checkhome-api-<sufijo>` | en `plan-checkhome` | Va dentro del plan F1; sin Application Insights |
| Servidor SQL lógico | `sql-checkhome-<sufijo>` | — | El servidor lógico no cobra |
| Base de datos | `checkhome` | Serverless GP_S_Gen5_2 con **oferta gratuita** | 100.000 vCore-segundos y 32 GB al mes; al agotarse se **pausa** hasta el mes siguiente (`AutoPause`), no cobra |
| Presupuesto | `presupuesto-checkhome` | USD 1 al mes | Los presupuestos no cobran; avisan al 50 %, 80 % y 100 % |

Región: `brazilsouth` (la más cercana a Chile). Si la oferta gratuita de SQL no está disponible ahí para la
suscripción, se usa `eastus2`.

## Secretos

- Ninguna clave pasa por el repo ni por el chat.
- La clave del administrador SQL se genera en el momento, se usa una vez (migraciones y usuario de la API) y no
  se guarda: si hace falta otra vez se resetea con `az sql server update --admin-password`.
- La API se conecta con un usuario propio de la base, `checkhome_api`, con permisos solo de lectura y escritura
  de datos. Su cadena de conexión y la clave del JWT viven solo en la configuración de App Service
  (`SQL_CONNECTION_STRING`, `JWT_SECRET`).

## Comandos (se corren en el Mac de Hernan con su `az login`)

Variables:

```bash
RG=rg-checkhome; LOC=brazilsouth; SFX=$(openssl rand -hex 3)
APP=checkhome-api-$SFX; SQL=sql-checkhome-$SFX; DB=checkhome
TAGS="proyecto=app-hogar entorno=dev"
```

1. Chequeo previo (solo lectura): `az account show` debe decir la suscripción de prueba y `spendingLimit: On`.
2. Grupo: `az group create -n $RG -l $LOC --tags $TAGS`
3. Presupuesto USD 1 con alertas al correo de la cuenta: `bash infra/create-budget.sh`.
4. SQL:
   ```bash
   SQLPASS=$(openssl rand -base64 24)   # se queda en la terminal, no se imprime
   az sql server create -g $RG -n $SQL -l $LOC --admin-user checkhome_admin --admin-password "$SQLPASS"
   az sql db create -g $RG -s $SQL -n $DB --edition GeneralPurpose --compute-model Serverless \
     --family Gen5 --capacity 2 --use-free-limit --free-limit-exhaustion-behavior AutoPause \
     --backup-storage-redundancy Local --tags $TAGS
   az sql server firewall-rule create -g $RG -s $SQL -n azure-services --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
   az sql server firewall-rule create -g $RG -s $SQL -n mac-migraciones --start-ip-address <ip> --end-ip-address <ip>
   ```
5. Migraciones y usuario de la API (desde `api/`, con la conexión de administrador):
   `npm run migrate` y `node scripts/create-api-user.js` (genera la clave de `checkhome_api`).
   Después se borra la regla `mac-migraciones`.
6. App Service:
   ```bash
   az appservice plan create -g $RG -n plan-checkhome -l $LOC --is-linux --sku F1 --tags $TAGS
   az webapp create -g $RG -p plan-checkhome -n $APP --runtime "NODE:22-lts" --https-only true --tags $TAGS
   az webapp config appsettings set -g $RG -n $APP --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true \
     SQL_CONNECTION_STRING="<de create-api-user>" JWT_SECRET="$(openssl rand -base64 48)"
   ```
7. Despliegue: `bash api/scripts/package.sh` y `az webapp deploy -g $RG -n $APP --src-path checkhome-api.zip --type zip`.
8. Prueba: `curl https://<host>/health` y `curl https://<host>/uf`.

## Antes del 13 dic 2026

La prueba vence y la suscripción se deshabilita. Lo gratis sigue gratis solo si la suscripción pasa a pago por
uso, y eso se decide aparte (ver decisión 8 de `docs/mvp.md`). Nunca se hace "Upgrade" sin esa decisión.
