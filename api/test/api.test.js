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
  assert.equal(r.body.status, 'estimating', 'toda rutina nace en votación');
  assert.equal(r.body.myVote, 2, 'los puntos de quien la crea cuentan como su voto');
  assert.equal(r.body.pendingVoters, 1);
  assert.equal(r.body.points, undefined);
  assert.equal((await call('POST', `/routines/${r.body.id}/toggle`, {}, tb)).status, 409, 'no se marca hasta que voten todos');
  assert.equal((await call('POST', `/routines/${r.body.id}/vote`, { points: 4 }, tb)).status, 400);
  assert.equal((await call('POST', `/routines/${r.body.id}/vote`, { points: 2 }, tb)).status, 204);
  const [active] = (await call('GET', `/households/${hid}/routines`, null, ta)).body;
  assert.deepEqual([active.status, active.points], ['active', 2]);
  assert.equal((await call('POST', `/routines/${r.body.id}/vote`, { points: 5 }, ta)).status, 409, 'ya no está en votación');
  assert.equal((await call('POST', `/routines/${r.body.id}/toggle`, {}, tb)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/routines`, null, ta)).body[0].doneBy, b.body.user.id);
  // Cada uno elige las rutinas que hará: una persona por período, y se puede soltar.
  const rid = r.body.id;
  assert.equal((await call('POST', `/routines/${rid}/claim`, {}, ta)).status, 204);
  assert.equal((await call('POST', `/routines/${rid}/claim`, {}, ta)).status, 204, 'tomarla de nuevo no falla');
  assert.equal((await call('POST', `/routines/${rid}/claim`, {}, tb)).status, 409, 'ya la tomó otra persona');
  assert.equal((await call('GET', `/households/${hid}/routines`, null, tb)).body[0].claimedBy, a.body.user.id);
  assert.equal((await call('DELETE', `/routines/${rid}/claim`, null, tb)).status, 204, 'soltar una ajena no hace nada');
  assert.equal((await call('GET', `/households/${hid}/routines`, null, tb)).body[0].claimedBy, a.body.user.id);
  assert.equal((await call('DELETE', `/routines/${rid}/claim`, null, ta)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/routines`, null, tb)).body[0].claimedBy, undefined);
  assert.equal((await call('POST', `/routines/${rid}/claim`, {}, tb)).status, 204);
  const pendingVote = (await call('POST', `/households/${hid}/routines`, { name: 'Baño', frequency: 'weekly', points: 3 }, ta)).body;
  assert.equal((await call('POST', `/routines/${pendingVote.id}/claim`, {}, ta)).status, 409, 'no se toma mientras está en votación');
  assert.equal((await call('DELETE', `/routines/${pendingVote.id}`, null, ta)).status, 204);

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

  // Lista de compras compartida.
  assert.equal((await call('POST', `/households/${hid}/shopping`, { name: 'Leche', quantity: '2 cajas' }, ta)).status, 201);
  assert.equal((await call('POST', `/households/${hid}/shopping`, { name: '  ' }, ta)).status, 400);
  assert.equal((await call('POST', `/households/${hid}/shopping`, { name: 'Pan' }, tb)).status, 201);
  let shop = (await call('GET', `/households/${hid}/shopping`, null, tb)).body;
  assert.deepEqual(shop.map((i) => i.name), ['Pan', 'Leche']);
  const milk = shop.find((i) => i.name === 'Leche');
  assert.equal(milk.quantity, '2 cajas');
  assert.equal((await call('POST', `/shopping/${milk.id}/toggle`, {}, tb)).status, 204);
  shop = (await call('GET', `/households/${hid}/shopping`, null, ta)).body;
  assert.deepEqual(shop.map((i) => i.name), ['Pan', 'Leche'], 'lo comprado va al final');
  assert.equal(shop[1].boughtBy, b.body.user.id);
  assert.ok(shop[1].boughtAt);
  assert.equal((await call('DELETE', `/households/${hid}/shopping/bought`, null, ta)).status, 204);
  shop = (await call('GET', `/households/${hid}/shopping`, null, ta)).body;
  assert.deepEqual(shop.map((i) => i.name), ['Pan']);
  assert.equal((await call('DELETE', `/shopping/${shop[0].id}`, null, ta)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/shopping`, null, ta)).body.length, 0);
});

test('editar, borrar e historial de pagos', { skip: !cs && 'sin TEST_SQL_CONNECTION_STRING' }, async () => {
  const sfx = 'e' + Date.now().toString(36);
  const a = (await call('POST', '/auth/register', { email: `a${sfx}@x.cl`, username: `ana${sfx}`, displayName: 'Ana', password: 'secreta123' })).body;
  const b = (await call('POST', '/auth/register', { email: `b${sfx}@x.cl`, username: `beto${sfx}`, displayName: 'Beto', password: 'secreta123' })).body;
  const c = (await call('POST', '/auth/register', { email: `c${sfx}@x.cl`, username: `caro${sfx}`, displayName: 'Caro', password: 'secreta123' })).body;
  const ta = a.token;
  const tb = b.token;
  const hh = (await call('POST', '/households', { name: 'Casa' }, ta)).body;
  const hid = hh.id;
  await call('POST', '/households/join', { code: hh.inviteCode }, tb);

  // Gastos: quien lo anotó o un admin; alguien de otro hogar no lo ve.
  const cats = (await call('GET', `/households/${hid}/categories`, null, ta)).body;
  const expA = (await call('POST', `/households/${hid}/expenses`, { amount: 1000, categoryId: cats[0].id, description: 'Pan' }, ta)).body;
  const expB = (await call('POST', `/households/${hid}/expenses`, { amount: 2000, categoryId: cats[1].id }, tb)).body;
  assert.equal((await call('GET', `/expenses/${expA.id}`, null, tb)).body.canEdit, false);
  assert.equal((await call('GET', `/expenses/${expA.id}`, null, c.token)).status, 403);
  assert.equal((await call('PATCH', `/expenses/${expA.id}`, { amount: 5, categoryId: cats[0].id }, tb)).status, 403);
  const edited = await call('PATCH', `/expenses/${expA.id}`, { amount: 1500, categoryId: cats[2].id, description: 'Pan y huevos', spentOn: '2026-01-02' }, ta);
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.amount, 1500);
  assert.equal(edited.body.spentOn, '2026-01-02');
  assert.equal((await call('DELETE', `/expenses/${expB.id}`, null, ta)).status, 204, 'el admin puede borrar');
  assert.equal((await call('GET', `/expenses/${expB.id}`, null, ta)).status, 404);

  // Ingresos: solo su dueño los cambia; al hacer privada la fuente, sus pagos también quedan privados.
  const src = (await call('POST', `/households/${hid}/income-sources`, { name: 'Sueldo', payDay: 1, expectedAmount: 500000, isPrivate: false }, ta)).body;
  await call('POST', `/income-sources/${src.id}/incomes`, { amount: 500000 }, ta);
  const incomeMov = (await call('GET', `/households/${hid}/movements`, null, tb)).body.find((m) => m.kind === 'income');
  assert.ok(incomeMov?.id);
  assert.equal((await call('PATCH', `/incomes/${incomeMov.id}`, { amount: 1, receivedOn: '2026-01-01' }, tb)).status, 403);
  const inc = await call('PATCH', `/incomes/${incomeMov.id}`, { amount: 510000, receivedOn: '2026-11-01' }, ta);
  assert.equal(inc.body.amount, 510000);
  assert.equal(inc.body.sourceName, 'Sueldo');
  assert.equal((await call('PATCH', `/income-sources/${src.id}`, { name: 'Sueldo Ana', payDay: 5, expectedAmount: 510000, isPrivate: true }, tb)).status, 403);
  const src2 = await call('PATCH', `/income-sources/${src.id}`, { name: 'Sueldo Ana', payDay: 5, expectedAmount: 510000, isPrivate: true }, ta);
  assert.equal(src2.body.isPrivate, true);
  assert.equal((await call('GET', `/incomes/${incomeMov.id}`, null, tb)).status, 404, 'ahora es privado');
  assert.equal((await call('DELETE', `/income-sources/${src.id}`, null, ta)).status, 204);
  assert.equal((await call('GET', `/incomes/${incomeMov.id}`, null, ta)).status, 404, 'se borra con su fuente');

  // Cuentas fijas: editar, historial, deshacer el último pago y borrar.
  const ob = (await call('POST', `/households/${hid}/obligations`, { kind: 'loan', name: 'Crédito', amount: 100000, nextDueOn: '2026-03-10', installmentsTotal: 10, installmentsPaid: 4 }, ta)).body;
  const obEdit = await call('PATCH', `/obligations/${ob.id}`, { kind: 'loan', name: 'Crédito auto', amount: 120000, nextDueOn: '2026-03-15', everyMonths: 1, installmentsTotal: 12, installmentsPaid: 4 }, tb);
  assert.equal(obEdit.status, 200, JSON.stringify(obEdit.body));
  assert.equal(obEdit.body.name, 'Crédito auto');
  assert.equal(obEdit.body.installmentsTotal, 12);
  await call('POST', `/obligations/${ob.id}/pay`, {}, ta);
  await call('POST', `/obligations/${ob.id}/pay`, {}, tb);
  const pays = (await call('GET', `/obligations/${ob.id}/payments`, null, ta)).body;
  assert.equal(pays.length, 2);
  assert.deepEqual(pays.map((p) => p.canUndo), [true, false]);
  assert.equal(pays[0].amountClp, 120000);
  assert.equal((await call('DELETE', `/obligation-payments/${pays[1].id}`, null, ta)).status, 409, 'solo el último');
  assert.equal((await call('DELETE', `/obligation-payments/${pays[0].id}`, null, c.token)).status, 403);
  assert.equal((await call('DELETE', `/obligation-payments/${pays[0].id}`, null, ta)).status, 204);
  const after1 = (await call('GET', `/obligations/${ob.id}`, null, ta)).body;
  assert.equal(after1.nextDueOn, '2026-04-15');
  assert.equal(after1.installmentsPaid, 5);
  assert.ok(after1.lastPaidOn);
  const payMov = (await call('GET', `/households/${hid}/movements`, null, ta)).body.find((m) => m.kind === 'payment');
  assert.equal(payMov.obligationId, ob.id);
  assert.equal((await call('DELETE', `/obligations/${ob.id}`, null, tb)).status, 204);
  assert.equal((await call('GET', `/obligations/${ob.id}`, null, ta)).status, 404);

  // Rutinas y backlog.
  const r = (await call('POST', `/households/${hid}/routines`, { name: 'Loza', frequency: 'daily', points: 2 }, ta)).body;
  await call('POST', `/routines/${r.id}/vote`, { points: 5 }, tb);
  await call('POST', `/routines/${r.id}/vote`, { points: 3 }, ta);
  await call('POST', `/routines/${r.id}/toggle`, {}, tb);
  const rEdit = await call('PATCH', `/routines/${r.id}`, { name: 'Lavar loza', frequency: 'weekly', points: 13 }, tb);
  assert.deepEqual([rEdit.body.name, rEdit.body.frequency, rEdit.body.points], ['Lavar loza', 'weekly', 5], 'vale el voto más alto y no se edita a mano');
  // Hogar de una persona: su voto basta. Quien entra después vota las rutinas que siguen pendientes.
  const solo = (await call('POST', '/households', { name: 'Depto' }, c.token)).body;
  const own = (await call('POST', `/households/${solo.id}/routines`, { name: 'Basura', frequency: 'weekly', points: 3 }, c.token)).body;
  assert.deepEqual([own.status, own.points], ['active', 3]);
  // Rutinas diarias solo algunos días de la semana (1 = lunes … 7 = domingo).
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const wd = ((new Date(`${todayIso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const other = (wd % 7) + 1;
  assert.equal((await call('POST', `/households/${solo.id}/routines`, { name: 'Regar', frequency: 'daily', days: [], points: 1 }, c.token)).status, 400);
  assert.equal((await call('POST', `/households/${solo.id}/routines`, { name: 'Regar', frequency: 'daily', days: [8], points: 1 }, c.token)).status, 400);
  const notToday = (await call('POST', `/households/${solo.id}/routines`, { name: 'Regar', frequency: 'daily', days: [other], points: 1 }, c.token)).body;
  assert.deepEqual([notToday.days, notToday.dueToday], [[other], false]);
  assert.equal((await call('POST', `/routines/${notToday.id}/toggle`, {}, c.token)).status, 409, 'no toca hoy');
  const edited2 = (await call('PATCH', `/routines/${notToday.id}`, { name: 'Regar', frequency: 'daily', days: [other, wd] }, c.token)).body;
  assert.deepEqual([edited2.days, edited2.dueToday], [[wd, other].sort(), true]);
  assert.equal((await call('POST', `/routines/${notToday.id}/toggle`, {}, c.token)).status, 204);
  assert.deepEqual(own.days, undefined, 'las semanales no tienen días');
  assert.equal((await call('DELETE', `/routines/${r.id}`, null, ta)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/routines`, null, ta)).body.length, 0);

  await call('POST', `/households/${hid}/backlog`, { title: 'Pintar' }, ta);
  const [task] = (await call('GET', `/households/${hid}/backlog`, null, ta)).body;
  await call('POST', `/backlog/${task.id}/vote`, { points: 5 }, tb);
  assert.equal((await call('PATCH', `/backlog/${task.id}`, { title: 'x' }, ta)).status, 400);
  assert.equal((await call('PATCH', `/backlog/${task.id}`, { title: 'Pintar la reja' }, ta)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/backlog`, null, ta)).body[0].title, 'Pintar la reja');
  assert.equal((await call('DELETE', `/backlog/${task.id}`, null, c.token)).status, 403);
  assert.equal((await call('DELETE', `/backlog/${task.id}`, null, tb)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/backlog`, null, ta)).body.length, 0);
});

test('vehículos con papeles y propiedades con dividendo y arriendo', { skip: !cs && 'sin TEST_SQL_CONNECTION_STRING' }, async () => {
  const sfx = 'v' + Date.now().toString(36);
  const a = (await call('POST', '/auth/register', { email: `a${sfx}@x.cl`, username: `ana${sfx}`, displayName: 'Ana', password: 'secreta123' })).body;
  const b = (await call('POST', '/auth/register', { email: `b${sfx}@x.cl`, username: `beto${sfx}`, displayName: 'Beto', password: 'secreta123' })).body;
  const ta = a.token;
  const tb = b.token;
  const hh = (await call('POST', '/households', { name: 'Casa' }, ta)).body;
  const hid = hh.id;
  await call('POST', '/households/join', { code: hh.inviteCode }, tb);
  const other = (await call('POST', '/households', { name: 'Otra' }, tb)).body;

  // Vehículo con dos papeles.
  const car = await call('POST', `/households/${hid}/vehicles`, { name: 'Auto', plate: 'ab-cd 12', model: 'Toyota Yaris', year: 2019 }, ta);
  assert.equal(car.status, 201, JSON.stringify(car.body));
  assert.equal(car.body.plate, 'ABCD12');
  assert.equal((await call('POST', `/households/${hid}/vehicles`, { name: 'X', year: 1800 }, ta)).status, 400);
  const permiso = await call('POST', `/households/${hid}/obligations`, { kind: 'vehicle_doc', name: 'Permiso de circulación', amount: 180000, nextDueOn: '2027-03-31', everyMonths: 12, vehicleId: car.body.id }, tb);
  assert.equal(permiso.status, 201, JSON.stringify(permiso.body));
  assert.equal(permiso.body.vehicleName, 'Auto');
  await call('POST', `/households/${hid}/obligations`, { kind: 'vehicle_doc', name: 'SOAP', amount: 9000, nextDueOn: '2027-03-31', everyMonths: 12, vehicleId: car.body.id }, ta);
  const foreignCar = (await call('POST', `/households/${other.id}/vehicles`, { name: 'Ajeno' }, tb)).body;
  assert.equal((await call('POST', `/households/${hid}/obligations`, { kind: 'vehicle_doc', name: 'SOAP', amount: 1, nextDueOn: '2027-03-31', vehicleId: foreignCar.id }, tb)).status, 400, 'vehículo de otro hogar');
  let vehicles = (await call('GET', `/households/${hid}/vehicles`, null, tb)).body;
  assert.equal(vehicles.length, 1);
  assert.deepEqual(vehicles[0].documents.map((d) => d.name).sort(), ['Permiso de circulación', 'SOAP']);
  assert.equal((await call('PATCH', `/vehicles/${car.body.id}`, { name: 'Yaris', plate: 'ABCD12', model: 'Toyota Yaris', year: 2019 }, tb)).body.name, 'Yaris');
  assert.equal((await call('DELETE', `/vehicles/${car.body.id}`, null, tb)).status, 204);
  const loose = (await call('GET', `/obligations/${permiso.body.id}`, null, ta)).body;
  assert.equal(loose.vehicleId, undefined, 'el papel queda como cuenta suelta');
  assert.equal(loose.name, 'Permiso de circulación');

  // Propiedad con dividendo en pesos y arriendo privado de Ana.
  const depto = (await call('POST', `/households/${hid}/properties`, { name: 'Depto', address: 'Calle 1' }, ta)).body;
  const div = (await call('POST', `/households/${hid}/obligations`, { kind: 'mortgage', name: 'Dividendo depto', amount: 400000, nextDueOn: '2026-01-05', propertyId: depto.id }, ta)).body;
  assert.equal(div.propertyName, 'Depto');
  await call('POST', `/obligations/${div.id}/pay`, {}, ta);
  const rent = (await call('POST', `/households/${hid}/income-sources`, { name: 'Arriendo depto', payDay: 5, expectedAmount: 550000, isPrivate: true, propertyId: depto.id }, ta)).body;
  assert.equal(rent.propertyId, depto.id);
  await call('POST', `/income-sources/${rent.id}/incomes`, { amount: 550000 }, ta);
  const [pa] = (await call('GET', `/households/${hid}/properties`, null, ta)).body;
  assert.equal(pa.mortgages.length, 1);
  assert.equal(pa.rentSources.length, 1);
  assert.equal(pa.rentThisMonth, 550000);
  assert.equal(pa.mortgagePaidThisMonth, 400000);
  const [pb] = (await call('GET', `/households/${hid}/properties`, null, tb)).body;
  assert.equal(pb.rentSources.length, 0, 'el arriendo privado no se ve');
  assert.equal(pb.rentThisMonth, 0);
  assert.equal((await call('PATCH', `/properties/${depto.id}`, { name: 'Depto Ñuñoa' }, tb)).body.name, 'Depto Ñuñoa');
  assert.equal((await call('DELETE', `/properties/${depto.id}`, null, tb)).status, 204);
  assert.equal((await call('GET', `/obligations/${div.id}`, null, ta)).body.propertyId, undefined);
  assert.equal((await call('GET', `/households/${hid}/properties`, null, ta)).body.length, 0);
});

test('documentos adjuntos de vehículos y propiedades', { skip: !cs && 'sin TEST_SQL_CONNECTION_STRING' }, async () => {
  const sfx = 'd' + Date.now().toString(36);
  const a = (await call('POST', '/auth/register', { email: `a${sfx}@x.cl`, username: `ana${sfx}`, displayName: 'Ana', password: 'secreta123' })).body;
  const c = (await call('POST', '/auth/register', { email: `c${sfx}@x.cl`, username: `caro${sfx}`, displayName: 'Caro', password: 'secreta123' })).body;
  const ta = a.token;
  const hid = (await call('POST', '/households', { name: 'Casa' }, ta)).body.id;
  const car = (await call('POST', `/households/${hid}/vehicles`, { name: 'Auto' }, ta)).body;
  const rt = (await call('POST', `/households/${hid}/obligations`, { kind: 'vehicle_doc', name: 'Revisión técnica', amount: 30000, nextDueOn: '2027-05-31', everyMonths: 12, vehicleId: car.id }, ta)).body;
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 7)]);

  // Copia digital de la revisión técnica, ligada al papel.
  const up = await call('POST', `/households/${hid}/attachments`, { obligationId: rt.id, kind: 'technical_review', title: 'Certificado revisión técnica', expiresOn: '2027-05-31', fileName: 'revisión.pdf', contentType: 'application/pdf', data: pdf.toString('base64') }, ta);
  assert.equal(up.status, 201, JSON.stringify(up.body));
  assert.equal(up.body.vehicleId, car.id);
  assert.equal(up.body.obligationId, rt.id);
  assert.equal(up.body.sizeBytes, pdf.length);
  assert.equal(up.body.status, 'ok');

  // Validaciones: tipo falso, archivo disfrazado, sin dueño, otro hogar, muy grande.
  const bad = (body) => call('POST', `/households/${hid}/attachments`, { kind: 'other', title: 'X', fileName: 'x', contentType: 'application/pdf', data: pdf.toString('base64'), vehicleId: car.id, ...body }, ta);
  assert.equal((await bad({ contentType: 'text/html' })).status, 400);
  assert.equal((await bad({ contentType: 'image/png' })).status, 400, 'un PDF no pasa por PNG');
  assert.equal((await bad({ vehicleId: undefined })).status, 400);
  assert.equal((await bad({ kind: 'malware' })).status, 400);
  assert.equal((await bad({ data: Buffer.concat([pdf, Buffer.alloc(4 * 1024 * 1024)]).toString('base64') })).status, 400);
  assert.equal((await call('POST', `/households/${hid}/attachments`, { kind: 'other', title: 'X', contentType: 'application/pdf', data: pdf.toString('base64'), vehicleId: car.id }, c.token)).status, 403);

  const [v] = (await call('GET', `/households/${hid}/vehicles`, null, ta)).body;
  assert.equal(v.attachments.length, 1);
  assert.equal(v.attachments[0].title, 'Certificado revisión técnica');

  // Abrir con enlace corto: funciona sin sesión, falla con token de otro documento o inventado.
  assert.equal((await call('POST', `/attachments/${up.body.id}/link`, {}, c.token)).status, 403);
  const link = (await call('POST', `/attachments/${up.body.id}/link`, {}, ta)).body;
  const file = await fetch(base + link.path);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.ok(Buffer.from(await file.arrayBuffer()).equals(pdf));
  assert.equal((await fetch(`${base}/attachments/${up.body.id}/file?t=nada`)).status, 403);
  assert.equal((await fetch(`${base}/attachments/${up.body.id}/file`, { headers: { authorization: `Bearer ${ta}` } })).status, 403, 'el token de sesión no sirve de enlace');

  // Foto de la escritura en una propiedad, sin vencimiento.
  const casa = (await call('POST', `/households/${hid}/properties`, { name: 'Casa' }, ta)).body;
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const deed = await call('POST', `/households/${hid}/attachments`, { propertyId: casa.id, kind: 'deed', title: 'Escritura', fileName: 'escritura.jpg', contentType: 'image/jpeg', data: `data:image/jpeg;base64,${jpg.toString('base64')}` }, ta);
  assert.equal(deed.status, 201, JSON.stringify(deed.body));
  assert.equal(deed.body.status, 'none');
  const edited = await call('PATCH', `/attachments/${deed.body.id}`, { kind: 'deed', title: 'Escritura casa', expiresOn: '2020-01-01' }, ta);
  assert.equal(edited.body.status, 'expired');
  assert.equal((await call('GET', `/households/${hid}/properties`, null, ta)).body[0].attachments.length, 1);

  // Borrar el papel deja el documento en el auto; borrar el auto borra sus documentos.
  assert.equal((await call('DELETE', `/obligations/${rt.id}`, null, ta)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/attachments`, null, ta)).body.find((x) => x.id === up.body.id).obligationId, undefined);
  assert.equal((await call('DELETE', `/vehicles/${car.id}`, null, ta)).status, 204);
  assert.equal((await call('DELETE', `/attachments/${deed.body.id}`, null, ta)).status, 204);
  assert.equal((await call('GET', `/households/${hid}/attachments`, null, ta)).body.length, 0);
});

test('medios de pago, cuadratura de la tarjeta y cierre del mes', { skip: !cs && 'sin TEST_SQL_CONNECTION_STRING' }, async () => {
  const sfx = 'f' + Date.now().toString(36);
  const a = (await call('POST', '/auth/register', { email: `a${sfx}@x.cl`, username: `her${sfx}`, displayName: 'Hernán', password: 'secreta123' })).body;
  const b = (await call('POST', '/auth/register', { email: `b${sfx}@x.cl`, username: `cami${sfx}`, displayName: 'Cami', password: 'secreta123' })).body;
  const ta = a.token;
  const tb = b.token;
  const hh = (await call('POST', '/households', { name: 'Casa' }, ta)).body;
  const hid = hh.id;
  await call('POST', '/households/join', { code: hh.inviteCode }, tb);
  const cats = (await call('GET', `/households/${hid}/categories`, null, ta)).body;

  // Sueldos 60/40: el reparto sale de ahí.
  await call('POST', `/households/${hid}/income-sources`, { name: 'Sueldo', payDay: 1, expectedAmount: 1500000, isPrivate: true }, ta);
  await call('POST', `/households/${hid}/income-sources`, { name: 'Sueldo', payDay: 1, expectedAmount: 1000000, isPrivate: false }, tb);

  const credit = await call('POST', `/households/${hid}/payment-methods`, { kind: 'credit', name: 'Visa Hernán', cutDay: 19, dueDay: 5 }, ta);
  assert.equal(credit.status, 201, JSON.stringify(credit.body));
  assert.equal((await call('POST', `/households/${hid}/payment-methods`, { kind: 'credit', name: 'X', cutDay: 40, dueDay: 5 }, ta)).status, 400);
  const debitB = (await call('POST', `/households/${hid}/payment-methods`, { kind: 'debit', name: 'Débito Cami' }, tb)).body;
  assert.equal(debitB.ownerUserId, b.user.id);

  let settings = (await call('GET', `/households/${hid}/finance-settings`, null, tb)).body;
  assert.equal(settings.cycleCutDay, 19, 'la primera tarjeta fija el corte del hogar');
  assert.equal(settings.shareSource, 'income');
  assert.deepEqual(settings.members.map((m) => m.share), [60, 40]);
  settings = (await call('PATCH', `/households/${hid}/finance-settings`, { cycleCutDay: 19, savingsGoal: 300000 }, ta)).body;
  assert.equal(settings.savingsGoal, 300000);

  // Ciclo del 20 sep al 19 oct.
  const exp = (body, t) => call('POST', `/households/${hid}/expenses`, { categoryId: cats[0].id, ...body }, t);
  const e1 = await exp({ amount: 500000, spentOn: '2026-10-01', paymentMethodId: credit.body.id }, ta);
  assert.equal(e1.status, 201, JSON.stringify(e1.body));
  assert.equal(e1.body.paymentMethodId, credit.body.id);
  await exp({ amount: 100000, spentOn: '2026-10-02', paymentMethodId: credit.body.id, personalUserId: b.user.id }, tb);
  await exp({ amount: 50000, spentOn: '2026-09-25', paymentMethodId: credit.body.id, personalUserId: a.user.id }, ta);
  await exp({ amount: 50000, spentOn: '2026-10-19', paymentMethodId: debitB.id }, tb);
  await exp({ amount: 99999, spentOn: '2026-10-20', paymentMethodId: credit.body.id }, ta); // ya es del ciclo siguiente

  // Editar sin mandar medio de pago lo mantiene (versión anterior de la app).
  const kept = await call('PATCH', `/expenses/${e1.body.id}`, { amount: 500000, categoryId: cats[0].id, spentOn: '2026-10-01' }, ta);
  assert.equal(kept.body.paymentMethodId, credit.body.id);

  const st = (await call('GET', `/payment-methods/${credit.body.id}/statement?end=2026-10-19`, null, tb)).body;
  assert.equal(st.start, '2026-09-20');
  assert.equal(st.dueOn, '2026-11-05');
  assert.equal(st.charged, 650000, 'facturado según la app');
  assert.equal(st.charges.length, 3);

  // Provisorio: nadie ha pagado la tarjeta; se supone que la paga su dueño.
  let c = (await call('GET', `/households/${hid}/closing?end=2026-10-01`, null, tb)).body;
  assert.equal(c.cycle.start, '2026-09-20');
  assert.equal(c.cycle.end, '2026-10-19');
  assert.equal(c.totals.household, 550000);
  assert.equal(c.totals.personal, 150000);
  assert.equal(c.pendingCard, 650000);
  assert.equal(c.isFinal, false);
  // Quién gastó con qué: lo que anotó cada uno, por medio de pago.
  const spendOf = (uid) => c.spendByMember.find((m) => m.userId === uid);
  assert.equal(spendOf(a.user.id).total, 550000);
  assert.deepEqual(spendOf(a.user.id).methods.map((x) => [x.name, x.amount]), [['Visa Hernán', 550000]]);
  assert.deepEqual(spendOf(b.user.id).methods.map((x) => [x.name, x.amount]), [['Visa Hernán', 100000], ['Débito Cami', 50000]]);

  // El débito también muestra sus gastos, por mes del hogar.
  const mv = (await call('GET', `/payment-methods/${debitB.id}/movements?end=2026-10-01`, null, ta)).body;
  assert.equal(mv.start, '2026-09-20');
  assert.equal(mv.total, 50000);
  assert.equal(mv.charges.length, 1);

  // Sin ?end, la tarjeta abre en el período en curso; payableEnd apunta al último estado ya cerrado.
  const now = (await call('GET', `/payment-methods/${credit.body.id}/statement`, null, ta)).body;
  assert.equal(now.isClosed, false);
  assert.ok(now.payableEnd <= now.end && now.payableEnd >= now.prevEnd, JSON.stringify(now));

  // El 5 Hernán paga la tarjeta (cuenta para el corte del 19 oct) y cada uno deposita su parte del ahorro.
  const pay = await call('POST', `/payment-methods/${credit.body.id}/payments`, { amount: 650000, paidOn: '2026-11-05' }, ta);
  assert.equal(pay.body.statementEnd, '2026-10-19');
  await call('POST', `/households/${hid}/savings`, { amount: 200000, depositedOn: '2026-10-10' }, ta);
  await call('POST', `/households/${hid}/savings`, { amount: 100000, depositedOn: '2026-10-10' }, tb);

  c = (await call('GET', `/households/${hid}/closing?end=2026-10-19`, null, tb)).body;
  assert.equal(c.isFinal, true, JSON.stringify(c));
  assert.equal(c.cards[0].pending, 0);
  assert.deepEqual(
    c.transfers.map((t) => [t.fromName, t.toName, t.amount]),
    [['Cami', 'Hernán', 290000]],
  );

  // Cerrar el mes guarda la foto; no se cierra dos veces ni un ciclo que no ha terminado.
  const closed = await call('POST', `/households/${hid}/closings`, { cycleEnd: '2026-10-19' }, tb);
  assert.equal(closed.status, 201, JSON.stringify(closed.body));
  assert.equal(closed.body.closed.closedBy, 'Cami');
  assert.equal(closed.body.closed.transfers[0].amount, 290000);
  assert.equal((await call('POST', `/households/${hid}/closings`, { cycleEnd: '2026-10-19' }, ta)).status, 409);
  assert.equal((await call('POST', `/households/${hid}/closings`, { cycleEnd: '2099-01-19' }, ta)).status, 400);
  assert.equal((await call('DELETE', `/households/${hid}/closings/2026-10-19`, null, ta)).status, 204);

  // Un medio de pago usado se archiva en vez de borrarse.
  assert.equal((await call('DELETE', `/payment-methods/${debitB.id}`, null, ta)).status, 204);
  const all = (await call('GET', `/households/${hid}/payment-methods?all=1`, null, ta)).body;
  assert.equal(all.find((m) => m.id === debitB.id).isArchived, true);
  assert.equal((await call('GET', `/households/${hid}/payment-methods`, null, ta)).body.length, 1);
});

test('categorías, mascotas y fechas clave', { skip: !cs && 'sin TEST_SQL_CONNECTION_STRING' }, async () => {
  const sfx = 'p' + Date.now().toString(36);
  const a = (await call('POST', '/auth/register', { email: `a${sfx}@x.cl`, username: `ana${sfx}`, displayName: 'Ana', password: 'secreta123' })).body;
  const ta = a.token;
  const hid = (await call('POST', '/households', { name: 'Casa' }, ta)).body.id;
  const other = (await call('POST', '/households', { name: 'Otra' }, ta)).body.id;

  // Categorías: se adivinan por el nombre si no vienen; null explícito la deja sin categoría.
  const loza = (await call('POST', `/households/${hid}/routines`, { name: 'Lavar la loza', frequency: 'daily', points: 1 }, ta)).body;
  assert.equal(loza.category, 'kitchen');
  const bano = (await call('POST', `/households/${hid}/routines`, { name: 'Limpiar el baño', frequency: 'weekly', points: 2 }, ta)).body;
  assert.equal(bano.category, 'bathroom', 'baño gana sobre limpieza');
  const libre = (await call('POST', `/households/${hid}/routines`, { name: 'Lavar la loza', frequency: 'daily', points: 1, category: null }, ta)).body;
  assert.equal(libre.category, undefined);
  assert.equal((await call('POST', `/households/${hid}/routines`, { name: 'X', frequency: 'daily', points: 1, category: 'zoo' }, ta)).status, 400);
  const kept = (await call('PATCH', `/routines/${loza.id}`, { name: 'Secar platos', frequency: 'daily' }, ta)).body;
  assert.equal(kept.category, 'kitchen', 'sin category en el cuerpo, se mantiene');
  const moved = (await call('PATCH', `/routines/${loza.id}`, { name: 'Secar platos', frequency: 'daily', category: 'cleaning' }, ta)).body;
  assert.equal(moved.category, 'cleaning');
  await call('POST', `/households/${hid}/backlog`, { title: 'Arreglar el enchufe' }, ta);
  const [task] = (await call('GET', `/households/${hid}/backlog`, null, ta)).body;
  assert.equal(task.category, 'repairs');
  await call('PATCH', `/backlog/${task.id}`, { title: 'Arreglar el enchufe del living', category: null }, ta);
  assert.equal((await call('GET', `/households/${hid}/backlog`, null, ta)).body[0].category, undefined);

  // Mascotas.
  assert.equal((await call('POST', `/households/${hid}/pets`, { name: 'Luna', species: 'dragon' }, ta)).status, 400);
  assert.equal((await call('POST', `/households/${hid}/pets`, { name: 'Luna', birthDate: '2999-01-01' }, ta)).status, 400);
  const luna = await call('POST', `/households/${hid}/pets`, { name: 'Luna', species: 'dog', birthDate: '2020-03-01' }, ta);
  assert.equal(luna.status, 201, JSON.stringify(luna.body));
  const foreignPet = (await call('POST', `/households/${other}/pets`, { name: 'Ajena', species: 'cat' }, ta)).body;

  // Rutina de una mascota: queda en Mascotas aunque el nombre diga otra cosa.
  const comida = (await call('POST', `/households/${hid}/routines`, { name: 'Darle comida', frequency: 'daily', points: 1, petId: luna.body.id }, ta)).body;
  assert.deepEqual([comida.petId, comida.category], [luna.body.id, 'pets']);
  assert.equal((await call('POST', `/households/${hid}/routines`, { name: 'Comida', frequency: 'daily', points: 1, petId: foreignPet.id }, ta)).status, 400, 'mascota de otro hogar');
  const keepPet = (await call('PATCH', `/routines/${comida.id}`, { name: 'Comida de la mañana', frequency: 'daily' }, ta)).body;
  assert.equal(keepPet.petId, luna.body.id, 'sin petId en el cuerpo, se mantiene');

  // Fechas clave: la próxima sale de la última más la repetición; "lo hicimos hoy" la corre.
  assert.equal((await call('POST', `/households/${hid}/key-dates`, { petId: luna.body.id, title: 'Vacuna' }, ta)).status, 400, 'sin fechas');
  assert.equal((await call('POST', `/households/${hid}/key-dates`, { title: 'Vacuna', nextOn: '2027-01-01' }, ta)).status, 400, 'sin dueño');
  const vacuna = await call('POST', `/households/${hid}/key-dates`, { petId: luna.body.id, title: 'Vacuna antirrábica', lastOn: '2026-03-10', everyMonths: 12 }, ta);
  assert.equal(vacuna.status, 201, JSON.stringify(vacuna.body));
  assert.equal(vacuna.body.nextOn, '2027-03-10');
  const unica = (await call('POST', `/households/${hid}/key-dates`, { petId: luna.body.id, title: 'Esterilización', nextOn: '2020-01-01' }, ta)).body;
  assert.equal(unica.status, 'overdue');
  const done = (await call('POST', `/key-dates/${vacuna.body.id}/done`, {}, ta)).body;
  assert.ok(done.lastOn > '2026-03-10');
  assert.equal(done.nextOn > done.lastOn, true);
  const doneOnce = (await call('POST', `/key-dates/${unica.id}/done`, {}, ta)).body;
  assert.deepEqual([doneOnce.nextOn, doneOnce.status], [undefined, 'none'], 'sin repetición, ya no queda pendiente');

  // Documento de la mascota.
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);
  const carnet = await call('POST', `/households/${hid}/attachments`, { petId: luna.body.id, kind: 'vaccination_card', title: 'Carnet', fileName: 'carnet.png', contentType: 'image/png', data: png.toString('base64') }, ta);
  assert.equal(carnet.status, 201, JSON.stringify(carnet.body));
  const [pet] = (await call('GET', `/households/${hid}/pets`, null, ta)).body;
  assert.deepEqual([pet.name, pet.birthDate, pet.keyDates.length, pet.attachments.length], ['Luna', '2020-03-01', 2, 1]);

  // Vehículo con rutina y fecha clave.
  const car = (await call('POST', `/households/${hid}/vehicles`, { name: 'Auto' }, ta)).body;
  const lavar = (await call('POST', `/households/${hid}/routines`, { name: 'Lavarlo', frequency: 'weekly', points: 2, vehicleId: car.id }, ta)).body;
  assert.deepEqual([lavar.vehicleId, lavar.category], [car.id, 'vehicles']);
  await call('POST', `/households/${hid}/key-dates`, { vehicleId: car.id, title: 'Mantención', nextOn: '2027-06-01', everyMonths: 6 }, ta);
  const [v] = (await call('GET', `/households/${hid}/vehicles`, null, ta)).body;
  assert.equal(v.keyDates[0].title, 'Mantención');

  // Borrar: las rutinas quedan como rutinas de la casa.
  assert.equal((await call('DELETE', `/pets/${luna.body.id}`, null, ta)).status, 204);
  assert.equal((await call('DELETE', `/vehicles/${car.id}`, null, ta)).status, 204);
  const left = (await call('GET', `/households/${hid}/routines`, null, ta)).body;
  assert.equal(left.find((r) => r.id === comida.id).petId, undefined);
  assert.equal(left.find((r) => r.id === lavar.id).vehicleId, undefined);
  assert.equal((await call('GET', `/households/${hid}/pets`, null, ta)).body.length, 0);
});
