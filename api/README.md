# API de CheckHome

Node/Express sobre Azure SQL, corre en las Functions de Static Web Apps Free ([ADR 0003](../docs/adr/0003-api-en-static-web-apps.md)).
La app la usa desde `app/src/services/api.ts`. Recursos y despliegue: [docs/azure.md](../docs/azure.md).

## Variables (configuración de la Static Web App, nunca en el repo)

| Variable | Qué es |
| --- | --- |
| `SQL_CONNECTION_STRING` | Conexión a la base con el usuario `checkhome_api` |
| `JWT_SECRET` | Clave para firmar las sesiones (JWT de 30 días), mínimo 32 caracteres |
| `APP_TIMEZONE` | Opcional, por defecto `America/Santiago` (define qué es "hoy") |

## Local

```bash
npm install
npm run migrate                      # con SQL_CONNECTION_STRING apuntando a una base de prueba
npm run dev                          # lee .env
TEST_SQL_CONNECTION_STRING=... npm test   # prueba de punta a punta; nunca contra la base de Azure
```

Para probar contra SQL Server en Docker:
`docker run -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=<clave> -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest`.

## Rutas

Sin sesión: `GET /health`, `GET /uf`, `POST /auth/register`, `POST /auth/login`.
Con `Authorization: Bearer <token>`: `/me`, `/households` (listar, crear, `join`), y por hogar `members`,
`invite-code`, `summary`, `movements`, `obligations`, `income-sources`, `categories`, `expenses`, `routines`,
`backlog`, `ranking`; además `/obligations/:id/pay`, `/income-sources/:id/incomes`, `/routines/:id/toggle` y
`/backlog/:id/vote|take|complete`. Cada ruta revisa que la persona sea miembro del hogar.

Editar y borrar (`PATCH` y `DELETE`): `/expenses/:id` (quien lo anotó o un administrador), `/incomes/:id` y
`/income-sources/:id` (solo su dueño; borrar una fuente borra sus pagos), `/obligations/:id` (borra también su
historial), `/routines/:id` y `/backlog/:id`. Además `GET /expenses/:id`, `GET /incomes/:id`, `GET /obligations/:id`,
`GET /obligations/:id/payments` (historial) y `DELETE /obligation-payments/:id`, que deshace solo el último pago y
devuelve el vencimiento un período atrás.

Patrimonio (migración `0003`): `/households/:id/vehicles` (cada vehículo con sus papeles) y
`/households/:id/properties` (cada propiedad con su dividendo, su arriendo y lo pagado y recibido en el mes), con
`POST` para crear y `PATCH`/`DELETE` en `/vehicles/:id` y `/properties/:id`. Al borrar un vehículo o propiedad, sus
cuentas e ingresos quedan sueltos, con su historial. Las obligaciones aceptan `vehicleId` (papeles del auto) y
`propertyId` (dividendo), y las fuentes de ingreso, `propertyId` (arriendo).

Medios de pago y cierre del mes (migración `0004`): `/households/:id/payment-methods` (crédito con `cutDay` y `dueDay`,
débito o efectivo; cada uno con su dueño), `PATCH`/`DELETE` en `/payment-methods/:id` (si ya se usó, se archiva),
`GET /payment-methods/:id/statement?end=` (facturado según la app, para cuadrar con el banco),
`POST /payment-methods/:id/payments` (pagar la tarjeta: pago de deuda, no gasto) y `DELETE /card-payments/:id`.
Los gastos aceptan `paymentMethodId` y `personalUserId` (vacío = del hogar); las obligaciones y su pago, `paymentMethodId`.
`/households/:id/finance-settings` (corte del ciclo, meta de ahorro, % fijos o por sueldos), `/households/:id/savings`
y `DELETE /savings-deposits/:id`, `GET /households/:id/closing?end=` (cierre del ciclo) y `POST /households/:id/closings`
/ `DELETE /households/:id/closings/:end` para cerrar y reabrir. Las cuentas del cierre están en `src/closing.js`.
