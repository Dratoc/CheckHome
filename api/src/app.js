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
// Subir un documento manda el archivo en base64 (hasta 4 MB, ~5,5 MB en base64); todo lo demás es chico.
const UPLOAD_PATH = /^\/households\/\d+\/attachments\/?$/;
const smallJson = express.json({ limit: '50kb' });
const uploadJson = express.json({ limit: '6mb' });
app.use((req, res, next) => (req.method === 'POST' && UPLOAD_PATH.test(req.path) ? uploadJson : smallJson)(req, res, next));

// La app móvil no necesita CORS. Solo para probar la versión web en local: CORS_ORIGIN=http://localhost:8081
if (process.env.CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Authorization, X-CheckHome-Token, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
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
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El archivo es muy grande (máximo 4 MB).' });
  console.error(req.method, req.path, err);
  res.status(500).json({ error: 'Algo falló en el servidor. Intenta de nuevo.' });
});
