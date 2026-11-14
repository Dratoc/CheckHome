/**
 * Prueba de punta a punta contra una base SQL Server real (local en Docker, nunca la de Azure).
 * Uso: TEST_SQL_CONNECTION_STRING=... npm test   (sin esa variable, se salta)
 */
import { spawn } from 'node:child_process';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

const cs = process.env.TEST_SQL_CONNECTION_STRING;
const PORT = 18080;
const base = `http://localhost:${PORT}`;
let server;

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

before(async () => {
  if (!cs) return;
  // TEST_TARGET=functions corre la misma prueba a través del adaptador de Azure Functions.
  const entry = process.env.TEST_TARGET === 'functions' ? 'test/functions-host.js' : 'src/server.js';
  server = spawn('node', [entry], {
    env: { ...process.env, SQL_CONNECTION_STRING: cs, JWT_SECRET: 'x'.repeat(40), PORT: String(PORT) },
    stdio: 'inherit',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base + '/health')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(() => server?.kill());

test('flujo completo de dos personas en un hogar', { skip: !cs && 'sin TEST_SQL_CONNECTION_STRING' }, async () => {
  const sfx = Date.now().toString(36);
  const a = await call('POST', '/auth/register', { email: `a${sfx}@x.cl`, username: `ana${sfx}`, displayName: 'Ana Pérez', password: 'secreta123' });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  const ta = a.body.token;

  assert.equal((await call('POST', '/auth/register', { email: `a${sfx}@x.cl`, username: `otro${sfx}`, displayName: 'X', password: 'secreta123' })).status, 409);
  assert.equal((await call('POST', '/auth/login', { identifier: `ANA${sfx}`, password: 'mala' })).status, 400);
  assert.equal((await call('POST', '/auth/login', { identifier: `ANA${sfx}`, password: 'secreta123' })).status, 200);
  assert.equal((await call('GET', '/households')).status, 401);

  const hh = await call('POST', '/households', { name: 'Casa' }, ta);
  assert.equal(hh.status, 201);
  assert.equal(hh.body.role, 'admin');
  const hid = hh.body.id;

  const b = await call('POST', '/auth/register', { email: `b${sfx}@x.cl`, username: `beto${sfx}`, displayName: 'Beto Soto', password: 'secreta123' });
  const tb = b.body.token;
  assert.equal((await call('GET', `/households/${hid}/members`, null, tb)).status, 403);
  const join = await call('POST', '/households/join', { code: hh.body.inviteCode.slice(0, 4) + '-' + hh.body.inviteCode.slice(4).toLowerCase() }, tb);
  assert.equal(join.status, 201, JSON.stringify(join.body));
  assert.equal(join.body.memberCount, 2);
  assert.equal((await call('POST', '/households/join', { code: hh.body.inviteCode }, tb)).status, 409);
  assert.equal((await call('POST', `/households/${hid}/invite-code`, {}, tb)).status, 403);

  const cats = await call('GET', `/households/${hid}/categories?kind=expense`, null, tb);
  assert.equal(cats.body.length, 6);
  const exp = await call('POST', `/households/${hid}/expenses`, { amount: 12500, categoryId: cats.body[0].id, description: 'Pan' }, tb);
  assert.equal(exp.status, 201);

  const src = await call('POST', `/households/${hid}/income-sources`, { name: 'Sueldo', payDay: 1, expectedAmount: 1000000, isPrivate: true }, ta);
  assert.equal(src.status, 201);
  assert.equal((await call('POST', `/income-sources/${src.body.id}/incomes`, { amount: 1000000 }, ta)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/income-sources`, null, tb)).body.length, 0, 'privado no se ve');

  const ob = await call('POST', `/households/${hid}/obligations`, { kind: 'loan', name: 'Crédito', amount: 100000, nextDueOn: '2026-01-05', everyMonths: 1, installmentsTotal: 3, installmentsPaid: 2 }, ta);
  assert.equal(ob.status, 201, JSON.stringify(ob.body));
  assert.equal(ob.body.status, 'overdue');
  assert.equal((await call('POST', `/obligations/${ob.body.id}/pay`, {}, tb)).status, 204);
  const obs = await call('GET', `/households/${hid}/obligations`, null, ta);
  assert.equal(obs.body[0].nextDueOn, '2026-02-05');
  assert.equal(obs.body[0].installmentsPaid, 3);

  // Obligación en UF: con un valor UF de hoy cargado a mano (en la prueba no hay salida a mindicador.cl).
  const uf = await call('GET', '/uf');
  if (uf.status !== 200) {
    const { default: sql } = await import('mssql');
    const pool = await new sql.ConnectionPool(cs).connect();
    await pool.request().query("INSERT INTO dbo.uf_values (value_date, value_clp, source) VALUES (CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific SA Standard Time' AS DATE), 40000, 'manual')");
    await pool.close();
  }
  const ufValue = (await call('GET', '/uf')).body.value;
  const div = await call('POST', `/households/${hid}/obligations`, { kind: 'mortgage', name: 'Dividendo', currency: 'UF', amount: 2.5, nextDueOn: '2030-01-10' }, ta);
  assert.equal(div.body.currency, 'UF');
  assert.equal(div.body.amountClp, Math.round(2.5 * ufValue));
  assert.equal((await call('POST', `/obligations/${div.body.id}/pay`, {}, ta)).status, 204);

  const sumA = (await call('GET', `/households/${hid}/summary`, null, ta)).body;
  const sumB = (await call('GET', `/households/${hid}/summary`, null, tb)).body;
  assert.equal(sumA.income, 1000000);
  assert.equal(sumB.income, 0);
  assert.equal(sumA.expenses, 12500);
  assert.equal(sumA.fixedPaid, 100000 + Math.round(2.5 * ufValue));

  const mov = await call('GET', `/households/${hid}/movements`, null, tb);
  assert.deepEqual(mov.body.map((m) => m.kind).sort(), ['expense', 'payment', 'payment']);

  const r = await call('POST', `/households/${hid}/routines`, { name: 'Loza', frequency: 'daily', points: 2 }, ta);
  assert.equal(r.status, 201);
  assert.equal((await call('POST', `/routines/${r.body.id}/toggle`, {}, tb)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/routines`, null, ta)).body[0].doneBy, b.body.user.id);

  assert.equal((await call('POST', `/households/${hid}/backlog`, { title: 'Pintar reja' }, ta)).status, 201);
  const [task] = (await call('GET', `/households/${hid}/backlog`, null, ta)).body;
  assert.equal(task.pendingVoters, 2);
  await call('POST', `/backlog/${task.id}/vote`, { points: 3 }, ta);
  assert.equal((await call('POST', `/backlog/${task.id}/take`, {}, tb)).status, 409, 'sigue en votación');
  await call('POST', `/backlog/${task.id}/vote`, { points: 8 }, tb);
  const [voted] = (await call('GET', `/households/${hid}/backlog`, null, ta)).body;
  assert.equal(voted.status, 'open');
  assert.equal(voted.points, 8);
  assert.equal((await call('POST', `/backlog/${task.id}/take`, {}, tb)).status, 204);
  assert.equal((await call('POST', `/backlog/${task.id}/complete`, {}, ta)).status, 403);
  assert.equal((await call('POST', `/backlog/${task.id}/complete`, {}, tb)).status, 204);

  const rank = (await call('GET', `/households/${hid}/ranking`, null, ta)).body;
  assert.equal(rank[0].user.username, `beto${sfx}`);
  assert.equal(rank[0].points, 10);
});
