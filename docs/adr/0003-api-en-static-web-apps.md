# ADR 0003 — La API corre en las Functions de Static Web Apps Free

- Estado: aceptada (reemplaza a la [ADR 0001](0001-api-en-app-service-f1.md))
- Fecha: 13 nov 2026

## Contexto

Al crear el plan App Service F1, Azure respondió que la suscripción de prueba tiene cuota 0 de F1 en Brazil South
y East US 2. El portal de cuotas indica "Azure subscription 1 is not eligible for quota adjustment. Consider
upgrading your subscription". Hacer Upgrade va contra la regla de cero gasto, así que F1 no es posible.

## Decisión

La misma API Express corre como **Azure Functions administradas de Static Web Apps, plan Free**: una sola
función HTTP (`api/src/functions/api.js`) recibe todo `/api/*` y se lo pasa a Express. El plan Free es gratis
de forma permanente y no usa cuota de App Service.

La base se crea en **East US 2**, la misma región de Static Web Apps, para que no haya tráfico entre regiones.

## Consecuencias

- La URL de la API es `https://<sitio>.azurestaticapps.net/api`.
- Límites del plan Free: funciones con tiempo máximo por llamada y sin "siempre encendido"; la primera
  llamada tras un rato sin uso tarda unos segundos. Suficiente para un hogar.
- La app manda el token en `Authorization` y también en `X-CheckHome-Token`, por si el proxy de Static Web Apps
  reemplaza el primero.
- `src/server.js` sigue sirviendo para desarrollo local y pruebas; la prueba de punta a punta corre también a
  través del adaptador de Functions (`TEST_TARGET=functions`).
- Si algún día la suscripción pasa a pago por uso, se puede volver a App Service F1 sin tocar el código.
