# ADR 0001 — La API corre en Azure App Service F1

- Estado: reemplazada por la [ADR 0003](0003-api-en-static-web-apps.md): la prueba gratuita no tiene cuota F1
- Fecha: 13 nov 2026

## Contexto

La app móvil no puede conectarse directo a Azure SQL: la cadena de conexión quedaría dentro del APK.
Hace falta una API ligera. Regla dura del proyecto: cero gasto en Azure. Al inicio la usan 2 teléfonos.

## Opciones

| Opción | Costo | Comentario |
| --- | --- | --- |
| App Service F1 (Linux) | Gratis | 1 GB RAM, 60 min de CPU al día, sin SLA; se duerme sin uso (arranque en frío) |
| Static Web Apps Free + Functions administradas | Gratis | Pensado para web; menos control del runtime y del login |
| Azure Functions Flex Consumption | Cobro pequeño | Exige una cuenta de Storage que se factura aparte |
| Container Apps | Riesgo de cobro | Nivel gratis generoso, pero suele requerir registro de contenedores y Log Analytics |

## Decisión

API Node/Express en **App Service F1**. HTTPS en `*.azurewebsites.net`. La cadena de conexión y la clave del
JWT van en la configuración de la app en Azure, nunca en el repo.

## Consecuencias

- La primera llamada tras un rato sin uso tarda unos segundos.
- Si el uso crece más allá de 60 min de CPU al día, habrá que revisar el plan.
- Lo gratis sigue gratis después del vencimiento de la prueba solo si la suscripción pasa a pago por uso.

Fuente: [precios de App Service en Linux](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/).
