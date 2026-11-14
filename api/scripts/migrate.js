/**
 * Aplica las migraciones de db/migrations en orden. Todas son idempotentes, así que correrlo de nuevo no
 * rompe nada. Uso: SQL_CONNECTION_STRING=... npm run migrate [-- carpeta]
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../src/db.js';

const here = dirname(fileURLToPath(import.meta.url));
// En el paquete de despliegue las migraciones van en api/migrations; en el repo, en db/migrations.
const dir = process.argv[2] ?? (await readdir(join(here, '..', 'migrations')).then(() => join(here, '..', 'migrations'), () => join(here, '..', '..', 'db', 'migrations')));

const files = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const pool = await getPool();
for (const f of files) {
  const text = await readFile(join(dir, f), 'utf8');
  const batches = text.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter((b) => b.replace(/--.*$/gm, '').trim());
  for (const b of batches) await pool.request().batch(b);
  console.log(`✓ ${f} (${batches.length} bloques)`);
}
await pool.close();
