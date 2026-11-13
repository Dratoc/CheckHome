# App del Hogar — guía para Claude

App móvil para organizar el hogar: **tareas** y **cuentas** (gastos/pagos compartidos).

## Stack (decisiones ya tomadas, no cambiar sin preguntar)
- **App:** React Native con Expo (TypeScript). Distribución por **APK en Android**; tiendas pospuestas.
- **Backend/datos:** Azure SQL Database en su **oferta gratuita**.
- **Nube:** cuenta Azure de **prueba gratuita que vence ~13 dic 2026**.
- **Regla dura: CERO GASTO.** Nada que genere cobro, ni "solo un poco". Ante la duda, no se crea y se pregunta.

## Estructura del repo (objetivo)
```
app/            # Expo (pantallas, componentes, navegación)
api/            # backend ligero (si se necesita) 
db/migrations/  # scripts SQL numerados: 0001_xxx.sql, 0002_xxx.sql
docs/           # diseño, decisiones (ADR), notas de Azure
.claude/        # agentes y skills de este proyecto
```

## Forma de trabajar
- Una rama por cambio: `feat/…`, `fix/…`, `chore/…`, `db/…`, `infra/…`. Nunca commits directos a `main`.
- Todo entra por Pull Request pequeño, con descripción en español.
- Commits estilo Conventional Commits en español: `feat: agrega lista de tareas`.
- Secretos (cadenas de conexión, claves) **nunca** en el repo: van en `.env` (ignorado) o en la configuración de Azure.
- Idioma: código y nombres en inglés; textos de UI, docs y PRs en español.

## Agentes disponibles (`.claude/agents/`)
| Agente | Úsalo para |
|---|---|
| `github-ramas` | ramas, commits, PRs, revisar estado del repo |
| `diseno` | pantallas, componentes, consistencia visual |
| `base-datos` | esquema SQL, migraciones, consultas |
| `azure` | recursos en Azure, costos, despliegue |

## Skills (`.claude/skills/`)
`/nueva-rama`, `/pantalla-nueva`, `/migracion-db`, `/chequeo-costo-azure`.
