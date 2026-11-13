/**
 * Crea (o renueva la clave de) el usuario de base de datos checkhome_api, con permisos solo de leer y
 * escribir datos. Se corre con la conexión de administrador en SQL_CONNECTION_STRING.
 * Imprime la cadena de conexión para la API en un archivo temporal (no en pantalla) y su ruta.
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sql from 'mssql';

const admin = process.env.SQL_CONNECTION_STRING;
if (!admin) throw new Error('Falta SQL_CONNECTION_STRING (conexión de administrador)');

const password = randomBytes(24).toString('base64url') + 'aA1!';
const pool = await new sql.ConnectionPool(admin).connect();
const db = pool.config.database;
await pool.request().batch(`
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'checkhome_api')
    CREATE USER checkhome_api WITH PASSWORD = '${password}';
ELSE
    ALTER USER checkhome_api WITH PASSWORD = '${password}';
ALTER ROLE db_datareader ADD MEMBER checkhome_api;
ALTER ROLE db_datawriter ADD MEMBER checkhome_api;
`);
const server = pool.config.server;
await pool.close();

const cs = `Server=tcp:${server},1433;Database=${db};User Id=checkhome_api;Password=${password};Encrypt=true;TrustServerCertificate=false;Connection Timeout=60`;
const file = join(tmpdir(), `checkhome-api-cs-${Date.now()}.txt`);
writeFileSync(file, cs, { mode: 0o600 });
console.log(`Usuario checkhome_api listo. Cadena de conexión guardada en ${file} (bórrala después de usarla).`);
