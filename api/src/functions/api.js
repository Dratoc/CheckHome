import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import azf from '@azure/functions';
import { app } from '../app.js';

/**
 * Azure Functions administradas de Static Web Apps (plan Free): una sola función recibe todo /api/* y se lo
 * pasa a la app Express, sin abrir puertos. Static Web Apps antepone /api a la ruta; aquí se quita.
 */
export async function handle(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);

  const req = new IncomingMessage(new Socket());
  req.method = request.method;
  req.url = path + url.search;
  req.headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
  if (hasBody) req.headers['content-length'] = String(body.length);
  if (body.length) req.push(body);
  req.push(null);

  return new Promise((resolve, reject) => {
    const res = new ServerResponse(req);
    const chunks = [];
    const add = (chunk, encoding) => {
      if (chunk && typeof chunk !== 'function') chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8'));
    };
    res.write = (chunk, encoding, cb) => {
      add(chunk, encoding);
      if (typeof encoding === 'function') encoding();
      else if (typeof cb === 'function') cb();
      return true;
    };
    res.end = (chunk, encoding, cb) => {
      add(chunk, encoding);
      const headers = {};
      for (const [k, v] of Object.entries(res.getHeaders())) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
      resolve({ status: res.statusCode, headers, body: Buffer.concat(chunks) });
      if (typeof chunk === 'function') chunk();
      else if (typeof encoding === 'function') encoding();
      else if (typeof cb === 'function') cb();
      return res;
    };
    try {
      app(req, res);
    } catch (e) {
      reject(e);
    }
  });
}

azf.app.http('api', {
  route: '{*path}',
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: handle,
});
