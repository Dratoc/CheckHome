/**
 * Imita al host de Azure Functions para las pruebas: cada petición HTTP se convierte en un HttpRequest de
 * @azure/functions y se entrega a la misma función que corre en Static Web Apps (con el prefijo /api).
 */
import { createServer } from 'node:http';
import azf from '@azure/functions';
import { handle } from '../src/functions/api.js';

const port = Number(process.env.PORT) || 18080;
createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]));
  const request = new azf.HttpRequest({
    method: req.method,
    url: `http://localhost:${port}/api${req.url}`,
    headers,
    body: chunks.length ? { string: Buffer.concat(chunks).toString('utf8') } : undefined,
  });
  const out = await handle(request);
  res.writeHead(out.status, out.headers);
  res.end(out.body);
}).listen(port, () => console.log(`Host de prueba de Functions en ${port}`));
