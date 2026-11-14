import express from 'express';
import { ApiError } from './errors.js';
import { router } from './routes.js';

/**
 * La app Express. Corre igual como servidor (src/server.js, para local) o dentro de Azure Functions
 * administradas por Static Web Apps (src/functions/api.js).
 */
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '50kb' }));

// La app móvil no necesita CORS. Solo para probar la versión web en local: CORS_ORIGIN=http://localhost:8081
if (process.env.CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Authorization, X-CheckHome-Token, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST',
    });
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
}

app.use(router);

app.use((_req, _res, next) => next(new ApiError(404, 'Ruta no encontrada.')));

// Errores: mensaje claro para la app, detalle solo en el log.
app.use((err, req, res, _next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos mal formados.' });
  console.error(req.method, req.path, err);
  res.status(500).json({ error: 'Algo falló en el servidor. Intenta de nuevo.' });
});
