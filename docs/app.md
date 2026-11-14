# App: estructura y cómo probarla

Esqueleto de la Fase 0 del [MVP](mvp.md). Todo funciona con **datos simulados**: aún no hay API ni Azure.

## Flujo

1. **Acceso:** bienvenida → crear cuenta (nombre, usuario, correo, clave) o ingresar. Sin correo de validación por ahora.
2. **Elegir hogar:** lista de hogares del usuario, crear uno nuevo (quedas como admin) o unirte con un código de 8 letras.
3. **Pestañas:** Inicio, Cuentas, Tareas y Hogar, con el botón global "+ Gasto".

## Carpetas (`app/src/`)

| Carpeta | Qué hay |
| --- | --- |
| `navigation/` | `RootNavigator` (acceso → elegir hogar → pestañas), `MainTabs`, tipos de rutas |
| `screens/auth/` | Bienvenida, registro, ingreso |
| `screens/household/` | Elegir, crear y unirse a hogar |
| `screens/tabs/` | Inicio, Cuentas, Tareas, Hogar |
| `screens/AddExpenseScreen.tsx` | Gasto rápido (modal) |
| `services/types.ts` | Tipos de dominio, alineados con `db/migrations/` |
| `services/mockDb.ts` | Datos de ejemplo en memoria (se reinician al abrir la app) |
| `services/api.ts` | API simulada con latencia. **Al conectar Azure solo cambia este archivo** |
| `state/SessionProvider.tsx` | Usuario y hogar actual |
| `hooks/` | `useQuery` / `useMutation` (carga, error, recarga al volver a la pantalla) |

## Datos de prueba

- Usuario con datos: `demo@checkhome.cl` (o `hernan`), clave `checkhome`. Está en "Casa Muñoz" y "Depto Viña".
- Códigos de invitación: `K7M2QX9P` (Casa Muñoz), `VN4H8TRA` (Depto Viña).
- Una cuenta nueva parte sin hogares; un hogar nuevo parte vacío, para ver los estados vacíos.

## Probar en desarrollo

```bash
cd app
npm install
npm start        # escanear el QR con Expo Go
npm run web      # en el navegador
npm run typecheck
```

## APK de prueba (cero gasto)

Dos caminos, ambos gratis:

1. **GitHub Actions (recomendado):** corre solo en cada PR que toque `app/`, o a mano en la pestaña *Actions* →
   *APK de prueba* → *Run workflow*. El último build queda siempre en el link fijo
   <https://github.com/Dratoc/CheckHome/releases/download/apk-prueba/checkhome.apk> (sin zip ni sesión). Tarda ~10 min y deja
   `app-release.apk` como artefacto del run. El repo es público, así que los minutos no se cobran. Ver
   `.github/workflows/apk-prueba.yml`.
2. **EAS Build, plan gratuito:** con una cuenta de Expo propia (gratis, sin tarjeta):
   `cd app && npx eas-cli login && npx eas-cli build -p android --profile preview`. Usa el perfil `preview` de
   `app/eas.json`, que genera un APK instalable. El plan gratuito tiene cupo mensual de builds; si se agota, espera
   al mes siguiente (no cobra si no hay plan pagado).

El APK está firmado con la clave de depuración: sirve para instalar en Android ("permitir apps de origen
desconocido"), no para la Play Store.
