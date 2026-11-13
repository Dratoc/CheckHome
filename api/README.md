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
