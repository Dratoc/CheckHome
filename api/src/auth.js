import jwt from 'jsonwebtoken';
import { ApiError } from './errors.js';

/** JWT de 30 días firmado con JWT_SECRET (configuración de App Service). */
const EXPIRES_IN = '30d';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET falta o es muy corto (mínimo 32 caracteres)');
  return s;
}

export function signToken(userId) {
  return jwt.sign({}, secret(), { subject: String(userId), expiresIn: EXPIRES_IN });
}

/** Middleware: exige Authorization: Bearer <token> y deja req.userId. */
export function requireAuth(req, _res, next) {
  // El proxy de Static Web Apps reemplaza Authorization por su propio token, así que X-CheckHome-Token manda.
  // Authorization queda para desarrollo local y otros hosts.
  const header = req.headers.authorization ?? '';
  const token = String(req.headers['x-checkhome-token'] ?? '') || (header.startsWith('Bearer ') ? header.slice(7) : '');
  try {
    const payload = jwt.verify(token, secret());
    req.userId = Number(payload.sub);
    if (!Number.isInteger(req.userId)) throw new Error('sub inválido');
    next();
  } catch {
    next(new ApiError(401, 'Tu sesión venció. Vuelve a iniciar sesión.'));
  }
}

/**
 * Enlace corto para abrir un documento en el navegador o el visor del teléfono, que no pueden mandar el encabezado
 * de sesión. Vale 10 minutos y solo para ese documento (como un SAS de Azure, pero firmado por la API).
 */
const FILE_AUDIENCE = 'attachment-file';

export function signFileToken(attachmentId) {
  return jwt.sign({}, secret(), { subject: String(attachmentId), audience: FILE_AUDIENCE, expiresIn: '10m' });
}

export function verifyFileToken(token, attachmentId) {
  try {
    const payload = jwt.verify(String(token ?? ''), secret(), { audience: FILE_AUDIENCE });
    return payload.sub === String(attachmentId);
  } catch {
    return false;
  }
}
