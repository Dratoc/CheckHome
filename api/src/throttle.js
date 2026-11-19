import { ApiError } from './errors.js';

/**
 * Freno a los intentos repetidos (adivinar claves, crear cuentas en masa). Vive en memoria de cada instancia de
 * la función: no toca la base, así no gasta el cupo gratis de Azure SQL. No es perfecto (cada instancia lleva su
 * cuenta y se reinicia al reciclarse), pero corta los ataques simples sin costo.
 */
export function createThrottle({ max, windowMs, message }) {
  // Las pruebas de punta a punta crean decenas de cuentas desde la misma IP.
  if (process.env.THROTTLE_DISABLED === '1') return { check() {}, hit() {}, reset() {} };
  const hits = new Map(); // clave -> { count, resetAt }

  function entry(key, now) {
    let e = hits.get(key);
    if (!e || e.resetAt <= now) {
      e = { count: 0, resetAt: now + windowMs };
      hits.set(key, e);
    }
    return e;
  }

  return {
    /** Lanza 429 si la clave ya llegó al máximo dentro de la ventana. */
    check(key, now = Date.now()) {
      const e = hits.get(key);
      if (e && e.resetAt > now && e.count >= max) {
        const minutes = Math.max(1, Math.ceil((e.resetAt - now) / 60_000));
        throw new ApiError(429, message.replace('{min}', String(minutes)));
      }
    },
    /** Cuenta un intento (fallido, en el caso del login). */
    hit(key, now = Date.now()) {
      entry(key, now).count++;
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
