import { date, query } from './db.js';
import { fromSql, today } from './dates.js';

/**
 * Valor de la UF del día (ADR 0002). Primero busca en uf_values; si no está, lo pide a mindicador.cl
 * y lo guarda. Si mindicador no responde, usa el último valor guardado.
 */
export async function getUf() {
  const t = today();
  const [row] = await query('SELECT value_clp FROM dbo.uf_values WHERE value_date = @d', { d: date(t) });
  if (row) return { date: t, value: Number(row.value_clp), source: 'cache' };

  try {
    const [y, m, d] = t.split('-');
    const res = await fetch(`https://mindicador.cl/api/uf/${d}-${m}-${y}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const value = Number(body?.serie?.[0]?.valor);
    if (!(value > 0)) throw new Error('respuesta sin valor');
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.uf_values WHERE value_date = @d)
         INSERT INTO dbo.uf_values (value_date, value_clp, source) VALUES (@d, @v, 'mindicador')`,
      { d: date(t), v: value },
    );
    return { date: t, value, source: 'mindicador' };
  } catch (err) {
    console.warn('UF: mindicador no respondió, uso el último valor guardado', err.message);
    const [last] = await query('SELECT TOP 1 value_date, value_clp FROM dbo.uf_values ORDER BY value_date DESC');
    if (last) return { date: fromSql(last.value_date), value: Number(last.value_clp), source: 'stale' };
    return null;
  }
}
