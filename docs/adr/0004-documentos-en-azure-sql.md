# ADR 0004 — Los documentos adjuntos se guardan en Azure SQL

- Estado: aceptada
- Fecha: 14 nov 2026

## Contexto

Queremos tener en la app la copia digital oficial de los papeles del auto y de la casa (revisión técnica, SOAP,
permiso de circulación, padrón, escritura, contrato de arriendo), en foto o PDF, para mostrarla cuando se
necesite. La regla es cero gasto.

Para un hogar de dos personas son unos 20 a 30 documentos al año. Con fotos comprimidas (~300 KB) y PDF de hasta
4 MB, eso da unos 30 a 50 MB al año.

| Opción | Costo | Por qué |
| --- | --- | --- |
| **Tabla en Azure SQL** (elegida) | Gratis | Usa la base que ya existe; la oferta gratuita (32 GB) no vence |
| Azure Blob Storage | Centavos después de 12 meses | Lo técnicamente ideal, pero el cupo gratis de 5 GB dura 12 meses y es un recurso nuevo que puede cobrar |
| Link a Google Drive | Gratis | No se ve dentro de la app y los links se rompen |

## Decisión

- Los datos del documento van en `dbo.attachments` y los bytes en `dbo.attachment_files` (migración `0005`), para
  que listar no lea los archivos.
- Cada documento es de un vehículo o de una propiedad y, si es la copia de un papel con vencimiento, también de
  esa cuenta (`obligation_id`). Tiene vencimiento opcional.
- La app comprime las fotos (lado mayor 1600 px, JPEG al 70 %). Tope de 4 MB por archivo y 200 MB por hogar.
- La API revisa el tipo real del archivo (PDF, JPG, PNG o WebP) por sus primeros bytes, no solo por lo que dice
  la app.
- Para ver un documento, la app pide un enlace que vale 10 minutos y solo sirve para ese documento (parecido a un
  SAS de Azure, firmado con la misma clave del JWT). Así el visor de PDF del teléfono o el navegador lo abren sin
  la sesión.

## Consecuencias

- No se crea ningún recurso nuevo en Azure.
- Cada documento que se abre usa un poco del cupo mensual de la base (100.000 vCore-segundos); con archivos de
  este tamaño no debería notarse. Si se agota, la base se pausa hasta el mes siguiente y no cobra.
- Si la suscripción se deshabilita al terminar la prueba (~13 dic 2026), los documentos no se pueden abrir hasta
  que se reactive. Conviene tener otra copia de los importantes.
- Si algún día crecen mucho, se pueden mover a Blob Storage cambiando solo la API: la app no sabe dónde viven.
- Falta probar en Static Web Apps real que un archivo de 4 MB pasa por las Functions administradas; en local
  pasa por el mismo adaptador.
