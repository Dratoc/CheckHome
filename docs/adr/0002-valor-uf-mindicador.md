# ADR 0002 — El valor de la UF se obtiene de mindicador.cl

- Estado: aceptada
- Fecha: 13 nov 2026

## Contexto

Dividendos y algunos créditos se pactan en UF y se pagan en pesos. Al registrar un pago, la app propone el
monto en pesos usando el valor UF del día.

## Opciones

| Opción | Comentario |
| --- | --- |
| API del Banco Central (BDE) | Oficial y gratuita; requiere registro y token que se renueva cada año |
| API de la CMF | Requiere clave |
| mindicador.cl | Sin registro; servicio comunitario sin garantía de disponibilidad |
| Manual | Sin dependencias; más trabajo para el usuario |

## Decisión

**mindicador.cl**, con el valor cacheado una vez al día en la tabla `uf_values`. Si el servicio no responde,
el usuario ingresa el valor a mano (`source = 'manual'`).

## Consecuencias

- Sin registro ni tokens que renovar.
- Si mindicador.cl deja de funcionar, se puede cambiar a la API del Banco Central sin tocar el esquema.
