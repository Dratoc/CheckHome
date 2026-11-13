---
name: migracion-db
description: Genera una migración SQL nueva para Azure SQL con el número siguiente. Úsala cuando haya que crear o cambiar tablas, columnas o índices.
---
1. Lista `db/migrations/` y toma el número siguiente (4 dígitos).
2. Crea `db/migrations/NNNN_<descripcion>.sql` siguiendo las reglas del agente `base-datos` (T-SQL, idempotente, DECIMAL para montos).
3. Si el cambio es destructivo (borra columna o datos), márcalo con un comentario `-- DESTRUCTIVO` al inicio y avísalo.
4. No la apliques a la base real; explica cómo aplicarla y espera aprobación.
