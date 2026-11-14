# CheckHome — MVP

Versión del 13 nov 2026. El documento de trabajo, con el diagrama de relaciones, está en
[CheckHome — Propuesta de MVP](https://claude.ai/artifact/56GzEq9u6eMzvqoDnn2yqb).

CheckHome resuelve dos cosas para una familia: **saber cuánto entra y cuánto sale, sin olvidar ningún
vencimiento**, y **repartir las tareas de la casa de forma visible y justa**.

## Módulos

| Área | Módulo | Qué resuelve |
| --- | --- | --- |
| Núcleo | Usuarios y hogares | Cuenta propia (correo y nombre de usuario); se entra a un hogar con un código de invitación; un usuario puede estar en varios hogares ("salas") y cambiar entre ellos |
| Cuentas | Ingresos | Fuentes (sueldo, arriendo, venta) definidas una vez con su día de pago; cada pago se anota a mano en pesos; privado o compartido |
| Cuentas | Gastos diarios | Anotar en segundos lo gastado fuera de los cargos fijos; siempre visible para el hogar |
| Cuentas | Gastos fijos | Servicios y suscripciones: vencimiento, número de cuenta, último pago, si van al día |
| Cuentas | Vehículos | Papeles de cada auto (permiso de circulación, revisión técnica, SOAP, seguro) con vencimiento e historial |
| Cuentas | Propiedades | Casas arrendadas: dividendo pagado (UF o pesos) y arriendo recibido |
| Cuentas | Créditos | Total de cuotas, valor, última pagada |
| Tareas | Rutinas | Checklist diario o semanal, definido una vez; da puntos |
| Tareas | Backlog | Tareas únicas estimadas por consenso (planning poker, Fibonacci, gana el voto más alto); quien la toma suma los puntos |

Idea central: gastos fijos, dividendos, cuotas y papeles del auto son **obligaciones** (algo que vence y se paga)
con su historial de **pagos**. Así los vencimientos y las métricas salen de un solo lugar.

## Modelo de datos (17 tablas + caché de UF)

- **Núcleo:** `users`, `households`, `household_members` (N a N con rol), `categories`.
- **Cuentas:** `income_sources`, `incomes`, `expenses`, `obligations` (kind: subscription, utility, mortgage,
  loan, vehicle_doc, other; currency CLP o UF), `obligation_payments` (pesos pagados y valor UF del día),
  `vehicles`, `properties`, `attachments` y `attachment_files` (documentos en foto o PDF, ver
  [ADR 0004](adr/0004-documentos-en-azure-sql.md)).
- **Tareas:** `routines` (con puntos), `routine_checks`, `backlog_tasks`, `task_votes`.
- **Apoyo:** `uf_values`, valor diario de la UF cacheado (ver ADR 0002).

Se calcula y no se guarda: estado al día de cada obligación, cargos fijos del mes, gasto fuera de lo
presupuestado, balance y ranking de puntos. Montos en `DECIMAL(12,2)`, montos en UF con 4 decimales.

## Pantallas

Acceso (registro, crear hogar o unirse con código, elegir hogar) y cuatro pestañas: **Inicio** (balance, vencimientos, checklist de hoy),
**Cuentas** (movimientos, fuentes de ingreso, obligaciones, vehículos, propiedades), **Tareas** (hoy, rutinas,
backlog, estimar, ranking) y **Hogar** (miembros, invitación, cambiar de hogar). Botón global "+ Gasto".

## Fases

1. **Fase 0 — Cimientos:** Expo con tabs, API mínima, migración `0001`, registro y hogares.
2. **Fase 1 — Plata del día a día:** ingresos, gasto rápido, gastos fijos con vencimientos, Inicio.
3. **Fase 2 — Rutinas:** checklist diario y semanal con puntos.
4. **Fase 3 — Backlog con puntos:** votación, "Me la llevo", ranking.
5. **Fase 4 — Patrimonio y deudas:** vehículos, propiedades, créditos.

Después del MVP: métricas y gráficos, notificaciones de vencimiento, fotos de boletas, exportar a Excel.

## Decisiones

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Conexión | La app habla por HTTPS con una API; la cadena de conexión vive solo en Azure ([ADR 0001](adr/0001-api-en-app-service-f1.md)) |
| 2 | Inicio de sesión | Registro con correo y nombre de usuario, sin validar el correo por ahora; se entra a un hogar con código de invitación; hogares como salas |
| 3 | UF | En UF cuando aplica; el pago guarda pesos y valor UF ([ADR 0002](adr/0002-valor-uf-mindicador.md)) |
| 4 | Ingresos | Fuente definida una vez; cada pago manual en pesos |
| 5 | Rutinas | Dan puntos; se definen una vez y se repiten |
| 6 | Puntos | Planning poker; queda el valor más alto |
| 7 | Privacidad | Ingresos pueden ser privados; gastos siempre compartidos |
| 8 | Fin de la prueba Azure (~13 dic 2026) | Se decide al terminar el período |
| 9 | Documentos adjuntos | En la misma base Azure SQL, no en Blob Storage; 4 MB por archivo y 200 MB por hogar ([ADR 0004](adr/0004-documentos-en-azure-sql.md)) |

Postergado: la validación del correo queda para después del MVP; mientras tanto, el acceso a cada hogar se controla con su código de invitación.
Token de sesión: JWT firmado por la API, clave en la configuración de App Service, 30 días.
