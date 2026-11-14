import sql from 'mssql';

/**
 * Pool único hacia Azure SQL. La cadena de conexión viene de la configuración de App Service
 * (SQL_CONNECTION_STRING), nunca del repo.
 */
let poolPromise;

export function getPool() {
  if (!poolPromise) {
    const cs = process.env.SQL_CONNECTION_STRING;
    if (!cs) throw new Error('Falta SQL_CONNECTION_STRING');
    poolPromise = new sql.ConnectionPool(cs).connect().catch((err) => {
      poolPromise = undefined;
      throw err;
    });
  }
  return poolPromise;
}

/**
 * Ejecuta una consulta con parámetros nombrados: query('SELECT ... WHERE id = @id', { id: 1 }).
 * Los tipos se infieren; para fechas YYYY-MM-DD se usa sql.Date explícito con { value, type }.
 */
export async function query(text, params = {}, tx) {
  const req = tx ? new sql.Request(tx) : (await getPool()).request();
  for (const [name, p] of Object.entries(params)) {
    if (p && typeof p === 'object' && 'type' in p) req.input(name, p.type, p.value);
    else req.input(name, p);
  }
  const result = await req.query(text);
  return result.recordset ?? [];
}

/** Corre fn dentro de una transacción. */
export async function transaction(fn) {
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const out = await fn(tx);
    await tx.commit();
    return out;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

export const date = (value) => ({ type: sql.Date, value });

export { sql };
