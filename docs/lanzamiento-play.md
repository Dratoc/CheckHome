# Lanzamiento en Google Play

Plan completo y decisiones: [CheckHome — Plan de lanzamiento en Google Play](https://claude.ai/artifact/DWNEPdrWdkCNZp12qPM1g6).
Solo Android por ahora (iOS cuesta US$99 al año). Decisión del 19 nov 2026: **registro abierto, vigilando el
consumo de la base cada semana**; si a mitad de mes va sobre el 50 %, se activa el cupo limitado.

## Datos fijos

| | |
| --- | --- |
| Package | `com.dratoc.checkhome` (no se puede cambiar después de publicar) |
| Política de privacidad | `https://<sitio>/privacidad` (`web/privacidad.html`) |
| Borrar cuenta (web) | `https://<sitio>/eliminar-cuenta` (`web/eliminar-cuenta.html`) |
| Borrar cuenta (app) | Hogar → Eliminar mi cuenta (`POST /api/account/delete`) |
| Build para la tienda | Actions → "AAB para Google Play" (`.github/workflows/aab-play.yml`) |

Desarrollador en Play: **granadadevs**. Correo público de contacto: morenofonseca.hernan@gmail.com
(es el que aparece en la ficha y en las páginas de `web/`).

## Paso a paso

1. **Cuenta de desarrollador** (Hernan, US$25 una vez): play.google.com/console → cuenta personal → verificación
   con carnet. Puede tardar unos días.
2. **Clave de subida** (Hernan, una vez): `bash infra/android-upload-key.sh` en el Mac y pegar los 4 secretos en
   GitHub. Respaldar `~/checkhome-keys/`.
3. **Desplegar** API y páginas: `deploy-swa.sh` como siempre (sin recursos nuevos, sigue en Free).
4. **Primer AAB**: Actions → "AAB para Google Play" → Run workflow → descargar el artefacto.
5. **Crear la app** en la consola: nombre CheckHome, idioma español (Latinoamérica), app, gratis. Activar
   **Play App Signing** (viene por defecto) y subir el AAB a **Prueba interna**.
6. **Completar** (textos abajo): ficha de la tienda, política de privacidad, acceso a la app (cuenta de prueba),
   anuncios (no), clasificación de contenido, público objetivo (18+), seguridad de los datos, app de finanzas
   (declarar que no ofrece préstamos ni servicios financieros: solo registra gastos).
7. **Prueba cerrada**: crear la pista con una lista de correos (12 o más testers con Android) y mantenerla
   **14 días seguidos** con al menos 12 testers inscritos. Pedirles que la usen de verdad y dejar comentarios.
8. **Acceso a producción**: al cumplir los 14 días, pedirlo desde el panel. Google pregunta cómo fue la prueba.

## Textos para la ficha

**Nombre:** CheckHome

**Descripción corta (80):** Gastos, cuentas y tareas de la casa, compartidos con tu familia.

**Descripción larga:**

> CheckHome ordena la casa entre todos.
>
> 💸 Cuentas claras: anota gastos en segundos, separa lo de la casa y lo personal, controla la tarjeta y cierra el
> mes sabiendo quién le transfiere a quién.
> 📅 Sin olvidar vencimientos: servicios, dividendos en UF, créditos, permiso de circulación, revisión técnica y
> SOAP, con aviso de lo que vence.
> ✅ Tareas justas: rutinas diarias y semanales con puntos, tareas únicas estimadas entre todos y ranking del hogar.
> 🛒 Lista de compras compartida.
> 🐾 Mascotas y autos: vacunas, controles, mantenciones y sus documentos en un solo lugar.
> 🏠 Varios hogares: entra con un código de invitación y cambia entre ellos.
>
> Sin publicidad. Tus ingresos pueden ser privados. Puedes borrar tu cuenta cuando quieras desde la app.

**Categoría:** Casa y hogar (o Finanzas). **Correo de contacto:** el mismo de la política.

## Seguridad de los datos (respuestas)

- ¿Recopila o comparte datos? **Recopila, no comparte.**
- Cifrado en tránsito: **Sí**. Se puede pedir el borrado: **Sí** (app y web).
- Datos recopilados (todos "obligatorios" salvo fotos; ninguno para publicidad ni analítica):
  - Información personal → **Nombre**, **Correo electrónico**, **ID de usuario** (nombre de usuario): funcionalidad
    de la app, administración de la cuenta.
  - Información financiera → **Otra información financiera** (gastos e ingresos que anota la persona):
    funcionalidad de la app. No se recopila información de pago ni número de tarjeta.
  - Fotos y videos → **Fotos** (opcional, documentos adjuntos): funcionalidad de la app.
  - Archivos y documentos → **Archivos y documentos** (opcional, PDF adjuntos): funcionalidad de la app.
- No se recopila: ubicación, contactos, mensajes, identificadores del dispositivo, historial web, salud, audio.

## Clasificación de contenido (IARC)

Categoría "Utilidad, productividad, comunicación u otra". Violencia, sexo, lenguaje, drogas, apuestas: **No**.
¿Los usuarios interactúan o comparten contenido? **Sí** (solo dentro de su hogar, con personas que invitan).
¿Comparte la ubicación? **No**. ¿Compras digitales? **No**.

## Cuenta de prueba para la revisión de Google

Crear una cuenta `revision-google` con un hogar de ejemplo (unos gastos, una cuenta, rutinas) y poner usuario y
clave en "Acceso a la app". No usar datos reales.

## Vigilar la base gratis (cada semana)

La oferta gratis da 100.000 vCore-segundos al mes (~55 h de base encendida). Con el `az login` de Hernan:

```bash
DB_ID=$(az sql db show -g rg-checkhome -s sql-checkhome-e20fee -n checkhome --query id -o tsv)
az monitor metrics list --resource "$DB_ID" --metric free_amount_remaining --interval PT1H \
  --start-time "$(date -u -v-1d +%Y-%m-%dT%H:%MZ)" --query "value[0].timeseries[0].data[-1]" -o json
```

Si a mitad de mes queda menos del 50 %, activar el cupo limitado de registro (pendiente de construir) antes de que
se acabe: al agotarse la base se pausa hasta el mes siguiente y la app queda caída para todos.
