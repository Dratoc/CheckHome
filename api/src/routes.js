import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { requireAuth, signToken } from './auth.js';
import { date, query, transaction } from './db.js';
import { addMonths, daysUntil, formatShortDate, fromSql, isIsoDate, monthStart, nextMonthStart, today, weekStart } from './dates.js';
import { badRequest, conflict, forbidden, notFound } from './errors.js';
import { getUf } from './uf.js';
import { cardStatementIn, cycleLabel, cycleOf, dueDateOf, nextCycle, previousCycle, statementPaidOn } from './cycle.js';
import { computeClosing, computeShares } from './closing.js';

export const router = Router();

// Express 4 no captura errores de funciones async: este envoltorio los pasa a next().
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Validación ----------

function str(v, field, { min = 1, max = 100 } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min) throw badRequest(`Falta ${field}.`);
  if (s.length > max) throw badRequest(`${field} es muy largo (máximo ${max}).`);
  return s;
}

function num(v, field, { min = 0, max = 1e10, int = false } = {}) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    throw badRequest(`${field} no es válido.`);
  }
  return n;
}

function isoDate(v, field) {
  if (!isIsoDate(v)) throw badRequest(`${field} no es una fecha válida.`);
  return v;
}

function idParam(req, name = 'id') {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw notFound('No encontramos lo que buscas.');
  return n;
}

// ---------- Helpers ----------

const publicUser = (r) => ({ id: r.id, email: r.email, username: r.username, displayName: r.display_name });

async function requireMember(householdId, userId) {
  const [m] = await query('SELECT role FROM dbo.household_members WHERE household_id = @h AND user_id = @u', {
    h: householdId,
    u: userId,
  });
  if (!m) throw forbidden('No perteneces a este hogar.');
  return m;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newInviteCode() {
  return Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');
}

export function normalizeInviteCode(raw) {
  return String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
}

const DEFAULT_EXPENSE_CATEGORIES = [
  ['Supermercado', 'cart-outline'],
  ['Comida fuera', 'restaurant-outline'],
  ['Transporte', 'car-outline'],
  ['Casa', 'home-outline'],
  ['Salud', 'medkit-outline'],
  ['Otros', 'ellipsis-horizontal'],
];

const householdRow = (r) => ({
  id: r.id,
  name: r.name,
  inviteCode: r.invite_code,
  currency: r.currency.trim(),
  role: r.role,
  memberCount: r.member_count,
});

async function myHousehold(householdId, userId, tx) {
  const [r] = await query(
    `SELECT h.id, h.name, h.invite_code, h.currency, m.role,
            (SELECT COUNT(*) FROM dbo.household_members x WHERE x.household_id = h.id) AS member_count
       FROM dbo.households h JOIN dbo.household_members m ON m.household_id = h.id AND m.user_id = @u
      WHERE h.id = @h`,
    { h: householdId, u: userId },
    tx,
  );
  return householdRow(r);
}

// ---------- Salud y UF (sin sesión) ----------

router.get('/health', (_req, res) => res.json({ ok: true }));

router.get(
  '/uf',
  h(async (_req, res) => {
    const uf = await getUf();
    if (!uf) throw notFound('No tenemos el valor de la UF de hoy.');
    res.json(uf);
  }),
);

// ---------- Acceso ----------

function session(userRow) {
  return { token: signToken(userRow.id), user: publicUser(userRow) };
}

router.post(
  '/auth/register',
  h(async (req, res) => {
    const email = str(req.body.email, 'el correo', { max: 254 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('El correo no es válido.');
    const username = str(req.body.username, 'el nombre de usuario', { min: 3, max: 50 }).toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(username)) throw badRequest('El nombre de usuario solo puede tener letras, números, punto, guion y guion bajo.');
    const displayName = str(req.body.displayName, 'tu nombre', { max: 100 });
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres.');

    const taken = await query('SELECT email, username FROM dbo.users WHERE email = @e OR username = @u', { e: email, u: username });
    if (taken.some((r) => r.email === email)) throw conflict('Ese correo ya tiene una cuenta.');
    if (taken.length) throw conflict('Ese nombre de usuario ya está en uso.');

    const hash = await bcrypt.hash(password, 10);
    const [row] = await query(
      `INSERT INTO dbo.users (email, username, display_name, password_hash)
       OUTPUT INSERTED.id, INSERTED.email, INSERTED.username, INSERTED.display_name
       VALUES (@e, @u, @n, @p)`,
      { e: email, u: username, n: displayName, p: hash },
    );
    res.status(201).json(session(row));
  }),
);

router.post(
  '/auth/login',
  h(async (req, res) => {
    const id = String(req.body.identifier ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const [row] = await query(
      'SELECT id, email, username, display_name, password_hash FROM dbo.users WHERE email = @i OR username = @i',
      { i: id },
    );
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      throw badRequest('Correo o contraseña incorrectos.');
    }
    res.json(session(row));
  }),
);

// Todo lo que sigue exige sesión.
router.use(requireAuth);

router.get(
  '/me',
  h(async (req, res) => {
    const [row] = await query('SELECT id, email, username, display_name FROM dbo.users WHERE id = @u', { u: req.userId });
    if (!row) throw notFound('Tu cuenta ya no existe.');
    res.json(publicUser(row));
  }),
);

// ---------- Hogares ----------

router.get(
  '/households',
  h(async (req, res) => {
    const rows = await query(
      `SELECT h.id, h.name, h.invite_code, h.currency, m.role,
              (SELECT COUNT(*) FROM dbo.household_members x WHERE x.household_id = h.id) AS member_count
         FROM dbo.households h JOIN dbo.household_members m ON m.household_id = h.id
        WHERE m.user_id = @u
        ORDER BY m.joined_at`,
      { u: req.userId },
    );
    res.json(rows.map(householdRow));
  }),
);

router.post(
  '/households',
  h(async (req, res) => {
    const name = str(req.body.name, 'el nombre del hogar', { max: 100 });
    const household = await transaction(async (tx) => {
      let id;
      for (let attempt = 0; !id; attempt++) {
        try {
          [{ id }] = await query('INSERT INTO dbo.households (name, invite_code) OUTPUT INSERTED.id VALUES (@n, @c)', { n: name, c: newInviteCode() }, tx);
        } catch (e) {
          if (attempt >= 3 || e.number !== 2627) throw e; // 2627: código repetido, se reintenta
        }
      }
      await query("INSERT INTO dbo.household_members (household_id, user_id, role) VALUES (@h, @u, 'admin')", { h: id, u: req.userId }, tx);
      for (const [cat, icon] of DEFAULT_EXPENSE_CATEGORIES) {
        await query("INSERT INTO dbo.categories (household_id, kind, name, icon) VALUES (@h, 'expense', @n, @i)", { h: id, n: cat, i: icon }, tx);
      }
      return myHousehold(id, req.userId, tx);
    });
    res.status(201).json(household);
  }),
);

router.post(
  '/households/join',
  h(async (req, res) => {
    const code = normalizeInviteCode(req.body.code);
    const [hh] = await query('SELECT id, name FROM dbo.households WHERE invite_code = @c', { c: code });
    if (!hh) throw notFound('No encontramos un hogar con ese código. Revisa que esté bien escrito.');
    const [already] = await query('SELECT 1 AS x FROM dbo.household_members WHERE household_id = @h AND user_id = @u', { h: hh.id, u: req.userId });
    if (already) throw conflict(`Ya eres parte de ${hh.name}.`);
    await query("INSERT INTO dbo.household_members (household_id, user_id, role) VALUES (@h, @u, 'member')", { h: hh.id, u: req.userId });
    res.status(201).json(await myHousehold(hh.id, req.userId));
  }),
);

router.get(
  '/households/:id/members',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const rows = await query(
      `SELECT u.id, u.email, u.username, u.display_name, m.role
         FROM dbo.household_members m JOIN dbo.users u ON u.id = m.user_id
        WHERE m.household_id = @h ORDER BY m.joined_at`,
      { h: hid },
    );
    res.json(rows.map((r) => ({ ...publicUser(r), role: r.role })));
  }),
);

router.post(
  '/households/:id/invite-code',
  h(async (req, res) => {
    const hid = idParam(req);
    if ((await requireMember(hid, req.userId)).role !== 'admin') throw forbidden('Solo un administrador puede cambiar el código.');
    const code = newInviteCode();
    await query('UPDATE dbo.households SET invite_code = @c, updated_at = SYSUTCDATETIME() WHERE id = @h', { c: code, h: hid });
    res.json({ inviteCode: code });
  }),
);

// ---------- Cuentas ----------

const OBLIGATION_KINDS = ['subscription', 'utility', 'mortgage', 'loan', 'vehicle_doc', 'other'];

// currency es CHAR(3): 'UF' vuelve como 'UF ' desde SQL.
const currencyOf = (r) => r.currency.trim();

function obligationView(r, ufValue) {
  const currency = currencyOf(r);
  const nextDueOn = fromSql(r.next_due_on);
  const daysLeft = daysUntil(nextDueOn);
  const amount = Number(r.amount);
  return {
    id: r.id,
    householdId: r.household_id,
    kind: r.kind,
    name: r.name,
    currency,
    amount,
    nextDueOn,
    everyMonths: r.every_months,
    accountNumber: r.account_number ?? undefined,
    lastPaidOn: fromSql(r.last_paid_on),
    installmentsTotal: r.installments_total ?? undefined,
    installmentsPaid: r.installments_paid ?? undefined,
    paymentMethodId: r.payment_method_id ?? undefined,
    vehicleId: r.vehicle_id ?? undefined,
    vehicleName: r.vehicle_name ?? undefined,
    propertyId: r.property_id ?? undefined,
    propertyName: r.property_name ?? undefined,
    daysLeft,
    status: daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'due_soon' : 'ok',
    amountClp: currency === 'UF' ? Math.round(amount * (ufValue ?? 0)) : amount,
  };
}

// Obligaciones con el nombre del vehículo o propiedad a la que pertenecen.
const OBLIGATION_SELECT = `SELECT o.*, v.name AS vehicle_name, p.name AS property_name
  FROM dbo.obligations o LEFT JOIN dbo.vehicles v ON v.id = o.vehicle_id LEFT JOIN dbo.properties p ON p.id = o.property_id`;

async function obligationViews(hid) {
  const rows = await query(`${OBLIGATION_SELECT} WHERE o.household_id = @h ORDER BY o.next_due_on, o.id`, { h: hid });
  const uf = rows.some((r) => currencyOf(r) === 'UF') ? (await getUf())?.value : undefined;
  return rows.map((r) => obligationView(r, uf));
}

router.get(
  '/households/:id/obligations',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    res.json(await obligationViews(hid));
  }),
);

/** Revisa que el vehículo o propiedad indicado sea del mismo hogar. */
async function linkedId(table, v, hid, label) {
  if (v == null || v === '') return null;
  const id = num(v, label, { min: 1, int: true });
  const [r] = await query(`SELECT 1 AS x FROM dbo.${table} WHERE id = @i AND household_id = @h`, { i: id, h: hid });
  if (!r) throw badRequest(`${label} no es válido.`);
  return id;
}

async function obligationInput(b, hid, keepMethod) {
  if (!OBLIGATION_KINDS.includes(b.kind)) throw badRequest('El tipo de cuenta no es válido.');
  const currency = b.currency === 'UF' ? 'UF' : 'CLP';
  const total = b.installmentsTotal == null || b.installmentsTotal === '' ? null : num(b.installmentsTotal, 'El total de cuotas', { min: 1, max: 1000, int: true });
  const paid = total == null ? null : num(b.installmentsPaid ?? 0, 'Las cuotas pagadas', { min: 0, max: total, int: true });
  return {
    k: b.kind,
    n: str(b.name, 'el nombre', { max: 100 }),
    c: currency,
    a: num(b.amount, 'El monto', { min: 0.0001 }),
    d: date(isoDate(b.nextDueOn, 'El vencimiento')),
    e: num(b.everyMonths ?? 1, 'La frecuencia', { min: 1, max: 24, int: true }),
    acc: b.accountNumber ? str(b.accountNumber, 'el número de cuenta', { max: 50 }) : null,
    it: total,
    ip: paid,
    vid: b.kind === 'vehicle_doc' ? await linkedId('vehicles', b.vehicleId, hid, 'El vehículo') : null,
    pid: b.kind === 'mortgage' ? await linkedId('properties', b.propertyId, hid, 'La propiedad') : null,
    pm: await paymentMethodId(b.paymentMethodId, hid, keepMethod),
  };
}

async function obligationOf(req) {
  const oid = idParam(req);
  const [o] = await query(`${OBLIGATION_SELECT} WHERE o.id = @o`, { o: oid });
  if (!o) throw notFound('No encontramos esa cuenta.');
  await requireMember(o.household_id, req.userId);
  return o;
}

async function obligationById(id) {
  const [row] = await query(`${OBLIGATION_SELECT} WHERE o.id = @o`, { o: id });
  return obligationWithUf(row);
}

async function obligationWithUf(row) {
  const uf = currencyOf(row) === 'UF' ? (await getUf())?.value : undefined;
  return obligationView(row, uf);
}

router.post(
  '/households/:id/obligations',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const [row] = await query(
      `INSERT INTO dbo.obligations (household_id, kind, name, currency, amount, next_due_on, every_months, account_number, installments_total, installments_paid, vehicle_id, property_id, payment_method_id)
       OUTPUT INSERTED.id
       VALUES (@h, @k, @n, @c, @a, @d, @e, @acc, @it, @ip, @vid, @pid, @pm)`,
      { h: hid, ...(await obligationInput(req.body, hid)) },
    );
    res.status(201).json(await obligationById(row.id));
  }),
);

router.get(
  '/obligations/:id',
  h(async (req, res) => {
    res.json(await obligationWithUf(await obligationOf(req)));
  }),
);

router.patch(
  '/obligations/:id',
  h(async (req, res) => {
    const o = await obligationOf(req);
    const [row] = await query(
      `UPDATE dbo.obligations
          SET kind = @k, name = @n, currency = @c, amount = @a, next_due_on = @d, every_months = @e, account_number = @acc,
              installments_total = @it, installments_paid = @ip, vehicle_id = @vid, property_id = @pid, payment_method_id = @pm, updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.id
        WHERE id = @o`,
      { o: o.id, ...(await obligationInput({ paymentMethodId: o.payment_method_id, ...req.body }, o.household_id, o.payment_method_id)) },
    );
    res.json(await obligationById(row.id));
  }),
);

/** Borra la cuenta junto con su historial de pagos. */
router.delete(
  '/obligations/:id',
  h(async (req, res) => {
    const o = await obligationOf(req);
    await transaction(async (tx) => {
      await query('DELETE FROM dbo.obligation_payments WHERE obligation_id = @o', { o: o.id }, tx);
      await query('DELETE FROM dbo.obligations WHERE id = @o', { o: o.id }, tx);
    });
    res.status(204).end();
  }),
);

/** Historial de pagos de una cuenta, del más reciente al más antiguo. */
router.get(
  '/obligations/:id/payments',
  h(async (req, res) => {
    const o = await obligationOf(req);
    const rows = await query(
      `SELECT p.id, p.obligation_id, p.user_id, p.amount_clp, p.uf_value, p.paid_on, u.display_name, pm.name AS method_name
         FROM dbo.obligation_payments p JOIN dbo.users u ON u.id = p.user_id LEFT JOIN dbo.payment_methods pm ON pm.id = p.payment_method_id
        WHERE p.obligation_id = @o ORDER BY p.paid_on DESC, p.id DESC`,
      { o: o.id },
    );
    res.json(
      rows.map((r, i) => ({
        id: r.id,
        obligationId: r.obligation_id,
        userId: r.user_id,
        paidBy: r.display_name,
        amountClp: Number(r.amount_clp),
        ufValue: r.uf_value == null ? undefined : Number(r.uf_value),
        paidOn: fromSql(r.paid_on),
        paymentMethodName: r.method_name ?? undefined,
        canUndo: i === 0,
      })),
    );
  }),
);

router.post(
  '/obligations/:id/pay',
  h(async (req, res) => {
    const oid = idParam(req);
    const [o] = await query('SELECT * FROM dbo.obligations WHERE id = @o', { o: oid });
    if (!o) throw notFound('No encontramos esa cuenta.');
    await requireMember(o.household_id, req.userId);
    const isUf = currencyOf(o) === 'UF';
    const uf = isUf ? (await getUf())?.value : null;
    if (isUf && !uf) throw badRequest('No tenemos el valor de la UF de hoy. Intenta más tarde.');
    const amountClp = req.body?.amountClp != null ? num(req.body.amountClp, 'El monto', { min: 1 }) : isUf ? Math.round(Number(o.amount) * uf) : Number(o.amount);
    const paidOn = today();
    // Con qué se pagó: lo que diga la app o, si no, el medio habitual de la cuenta.
    const pm = req.body && 'paymentMethodId' in req.body ? await paymentMethodId(req.body.paymentMethodId, o.household_id) : o.payment_method_id;
    await transaction(async (tx) => {
      await query(
        'INSERT INTO dbo.obligation_payments (obligation_id, user_id, amount_clp, uf_value, paid_on, payment_method_id) VALUES (@o, @u, @a, @uf, @d, @pm)',
        { o: oid, u: req.userId, a: amountClp, uf, d: date(paidOn), pm },
        tx,
      );
      await query(
        `UPDATE dbo.obligations
            SET last_paid_on = @d, next_due_on = @n, updated_at = SYSUTCDATETIME(),
                installments_paid = CASE WHEN installments_total IS NULL THEN installments_paid
                                         ELSE IIF(installments_paid + 1 > installments_total, installments_total, ISNULL(installments_paid, 0) + 1) END
          WHERE id = @o`,
        { o: oid, d: date(paidOn), n: date(addMonths(fromSql(o.next_due_on), o.every_months)) },
        tx,
      );
    });
    res.status(204).end();
  }),
);

/**
 * Deshace un "Marcar pagado" por error. Solo el último pago de la cuenta: así el vencimiento vuelve un período
 * atrás y la cuota pagada se descuenta, sin adivinar fechas.
 */
router.delete(
  '/obligation-payments/:id',
  h(async (req, res) => {
    const pid = idParam(req);
    const [p] = await query(
      `SELECT p.id, p.obligation_id, o.household_id, o.next_due_on, o.every_months, o.installments_total, o.installments_paid
         FROM dbo.obligation_payments p JOIN dbo.obligations o ON o.id = p.obligation_id WHERE p.id = @p`,
      { p: pid },
    );
    if (!p) throw notFound('No encontramos ese pago.');
    await requireMember(p.household_id, req.userId);
    const [last] = await query('SELECT TOP 1 id FROM dbo.obligation_payments WHERE obligation_id = @o ORDER BY paid_on DESC, id DESC', { o: p.obligation_id });
    if (last.id !== p.id) throw conflict('Solo se puede deshacer el último pago.');
    await transaction(async (tx) => {
      await query('DELETE FROM dbo.obligation_payments WHERE id = @p', { p: pid }, tx);
      const [prev] = await query('SELECT TOP 1 paid_on FROM dbo.obligation_payments WHERE obligation_id = @o ORDER BY paid_on DESC, id DESC', { o: p.obligation_id }, tx);
      await query(
        `UPDATE dbo.obligations
            SET next_due_on = @n, last_paid_on = @l, updated_at = SYSUTCDATETIME(),
                installments_paid = IIF(installments_total IS NULL OR installments_paid IS NULL OR installments_paid = 0, installments_paid, installments_paid - 1)
          WHERE id = @o`,
        { o: p.obligation_id, n: date(addMonths(fromSql(p.next_due_on), -p.every_months)), l: prev ? date(fromSql(prev.paid_on)) : null },
        tx,
      );
    });
    res.status(204).end();
  }),
);

// Ingresos visibles: los compartidos y los privados propios.
const VISIBLE_INCOME = '(i.is_private = 0 OR i.user_id = @u)';

router.get(
  '/households/:id/summary',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const t = today();
    const p = { h: hid, u: req.userId, from: date(monthStart(t)), to: date(nextMonthStart(t)) };
    const [income] = await query(`SELECT ISNULL(SUM(i.amount), 0) AS s FROM dbo.incomes i WHERE i.household_id = @h AND ${VISIBLE_INCOME} AND i.received_on >= @from AND i.received_on < @to`, p);
    const [expenses] = await query('SELECT ISNULL(SUM(amount), 0) AS s FROM dbo.expenses WHERE household_id = @h AND spent_on >= @from AND spent_on < @to', p);
    const [fixedPaid] = await query(
      `SELECT ISNULL(SUM(p.amount_clp), 0) AS s FROM dbo.obligation_payments p JOIN dbo.obligations o ON o.id = p.obligation_id
        WHERE o.household_id = @h AND p.paid_on >= @from AND p.paid_on < @to`,
      p,
    );
    const fixedPending = (await obligationViews(hid))
      .filter((o) => o.everyMonths === 1 && (o.nextDueOn.slice(0, 7) === t.slice(0, 7) || o.status === 'overdue'))
      .reduce((s, o) => s + o.amountClp, 0);
    const inc = Number(income.s);
    const exp = Number(expenses.s);
    const fp = Number(fixedPaid.s);
    res.json({ income: inc, expenses: exp, fixedPaid: fp, fixedPending, balance: inc - exp - fp });
  }),
);

router.get(
  '/households/:id/movements',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    // Últimos 3 meses: suficiente para la lista y liviano para el plan gratis.
    const p = { h: hid, u: req.userId, from: date(addMonths(monthStart(today()), -2)) };
    const firstName = (n) => String(n).split(' ')[0];
    const incomes = await query(
      `SELECT i.id, i.amount, i.received_on, i.is_private, s.name FROM dbo.incomes i JOIN dbo.income_sources s ON s.id = i.source_id
        WHERE i.household_id = @h AND ${VISIBLE_INCOME} AND i.received_on >= @from`,
      p,
    );
    const expenses = await query(
      `SELECT e.id, e.amount, e.spent_on, e.description, c.name AS category, u.display_name, pm.name AS method_name, pu.display_name AS personal_name
         FROM dbo.expenses e JOIN dbo.categories c ON c.id = e.category_id JOIN dbo.users u ON u.id = e.user_id
         LEFT JOIN dbo.payment_methods pm ON pm.id = e.payment_method_id LEFT JOIN dbo.users pu ON pu.id = e.personal_user_id
        WHERE e.household_id = @h AND e.spent_on >= @from`,
      p,
    );
    const payments = await query(
      `SELECT p.id, p.obligation_id, p.amount_clp, p.paid_on, o.name, u.display_name, pm.name AS method_name
         FROM dbo.obligation_payments p JOIN dbo.obligations o ON o.id = p.obligation_id JOIN dbo.users u ON u.id = p.user_id
         LEFT JOIN dbo.payment_methods pm ON pm.id = p.payment_method_id
        WHERE o.household_id = @h AND p.paid_on >= @from`,
      p,
    );
    const rows = [
      ...incomes.map((r) => {
        const d = fromSql(r.received_on);
        return { key: `i${r.id}`, id: r.id, kind: 'income', title: r.name, subtitle: `${formatShortDate(d)} · ${r.is_private ? 'Privado' : 'Compartido'}`, amount: Number(r.amount), date: d };
      }),
      ...expenses.map((r) => {
        const d = fromSql(r.spent_on);
        const parts = [formatShortDate(d), r.category, r.method_name ?? firstName(r.display_name), r.personal_name ? `Personal de ${firstName(r.personal_name)}` : null];
        return { key: `e${r.id}`, id: r.id, kind: 'expense', title: r.description || r.category, subtitle: parts.filter(Boolean).join(' · '), amount: Number(r.amount), date: d };
      }),
      ...payments.map((r) => {
        const d = fromSql(r.paid_on);
        return { key: `p${r.id}`, id: r.id, obligationId: r.obligation_id, kind: 'payment', title: r.name, subtitle: `${formatShortDate(d)} · Pago de cuenta · ${r.method_name ?? firstName(r.display_name)}`, amount: Number(r.amount_clp), date: d };
      }),
    ];
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));
    res.json(rows);
  }),
);

const incomeSourceRow = (r) => ({
  id: r.id,
  householdId: r.household_id,
  userId: r.user_id,
  name: r.name,
  payDay: r.pay_day,
  expectedAmount: Number(r.expected_amount),
  isPrivate: Boolean(r.is_private),
  propertyId: r.property_id ?? undefined,
});

router.get(
  '/households/:id/income-sources',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const rows = await query('SELECT * FROM dbo.income_sources WHERE household_id = @h AND (is_private = 0 OR user_id = @u) ORDER BY pay_day, id', { h: hid, u: req.userId });
    res.json(rows.map(incomeSourceRow));
  }),
);

router.post(
  '/households/:id/income-sources',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const b = req.body;
    const [row] = await query(
      `INSERT INTO dbo.income_sources (household_id, user_id, name, pay_day, expected_amount, is_private, property_id)
       OUTPUT INSERTED.* VALUES (@h, @u, @n, @d, @a, @p, @prop)`,
      {
        h: hid,
        prop: await linkedId('properties', b.propertyId, hid, 'La propiedad'),
        u: req.userId,
        n: str(b.name, 'el nombre', { max: 100 }),
        d: num(b.payDay, 'El día de pago', { min: 1, max: 31, int: true }),
        a: num(b.expectedAmount ?? 0, 'El monto esperado'),
        p: Boolean(b.isPrivate),
      },
    );
    res.status(201).json(incomeSourceRow(row));
  }),
);

router.post(
  '/income-sources/:id/incomes',
  h(async (req, res) => {
    const sid = idParam(req);
    const [s] = await query('SELECT * FROM dbo.income_sources WHERE id = @s', { s: sid });
    if (!s || (s.is_private && s.user_id !== req.userId)) throw notFound('No encontramos esa fuente de ingreso.');
    await requireMember(s.household_id, req.userId);
    const receivedOn = req.body.receivedOn ? isoDate(req.body.receivedOn, 'La fecha') : today();
    await query(
      'INSERT INTO dbo.incomes (source_id, household_id, user_id, amount, received_on, is_private) VALUES (@s, @h, @u, @a, @d, @p)',
      { s: sid, h: s.household_id, u: req.userId, a: num(req.body.amount, 'El monto', { min: 1 }), d: date(receivedOn), p: s.is_private },
    );
    res.status(204).end();
  }),
);

async function ownIncomeSource(req) {
  const sid = idParam(req);
  const [s] = await query('SELECT * FROM dbo.income_sources WHERE id = @s', { s: sid });
  if (!s || (s.is_private && s.user_id !== req.userId)) throw notFound('No encontramos esa fuente de ingreso.');
  await requireMember(s.household_id, req.userId);
  if (s.user_id !== req.userId) throw forbidden('Solo quien creó esta fuente puede cambiarla.');
  return s;
}

router.patch(
  '/income-sources/:id',
  h(async (req, res) => {
    const s = await ownIncomeSource(req);
    const b = req.body;
    const isPrivate = Boolean(b.isPrivate);
    const row = await transaction(async (tx) => {
      const [r] = await query(
        'UPDATE dbo.income_sources SET name = @n, pay_day = @d, expected_amount = @a, is_private = @p, property_id = @prop OUTPUT INSERTED.* WHERE id = @s',
        {
          s: s.id,
          prop: await linkedId('properties', b.propertyId, s.household_id, 'La propiedad'),
          n: str(b.name, 'el nombre', { max: 100 }),
          d: num(b.payDay, 'El día de pago', { min: 1, max: 31, int: true }),
          a: num(b.expectedAmount ?? 0, 'El monto esperado'),
          p: isPrivate,
        },
        tx,
      );
      // Los pagos ya anotados siguen la privacidad de su fuente.
      await query('UPDATE dbo.incomes SET is_private = @p WHERE source_id = @s', { s: s.id, p: isPrivate }, tx);
      return r;
    });
    res.json(incomeSourceRow(row));
  }),
);

/** Borra la fuente y todos sus pagos anotados. */
router.delete(
  '/income-sources/:id',
  h(async (req, res) => {
    const s = await ownIncomeSource(req);
    await transaction(async (tx) => {
      await query('DELETE FROM dbo.incomes WHERE source_id = @s', { s: s.id }, tx);
      await query('DELETE FROM dbo.income_sources WHERE id = @s', { s: s.id }, tx);
    });
    res.status(204).end();
  }),
);

async function ownIncome(req) {
  const iid = idParam(req);
  const [i] = await query('SELECT i.*, s.name FROM dbo.incomes i JOIN dbo.income_sources s ON s.id = i.source_id WHERE i.id = @i', { i: iid });
  if (!i || (i.is_private && i.user_id !== req.userId)) throw notFound('No encontramos ese ingreso.');
  await requireMember(i.household_id, req.userId);
  return i;
}

const incomeRow = (r) => ({
  id: r.id,
  sourceId: r.source_id,
  sourceName: r.name,
  householdId: r.household_id,
  userId: r.user_id,
  amount: Number(r.amount),
  receivedOn: fromSql(r.received_on),
  isPrivate: Boolean(r.is_private),
});

router.get(
  '/incomes/:id',
  h(async (req, res) => {
    res.json(incomeRow(await ownIncome(req)));
  }),
);

router.patch(
  '/incomes/:id',
  h(async (req, res) => {
    const i = await ownIncome(req);
    if (i.user_id !== req.userId) throw forbidden('Solo quien anotó este ingreso puede cambiarlo.');
    await query('UPDATE dbo.incomes SET amount = @a, received_on = @d WHERE id = @i', {
      i: i.id,
      a: num(req.body.amount, 'El monto', { min: 1 }),
      d: date(isoDate(req.body.receivedOn, 'La fecha')),
    });
    res.json(incomeRow(await ownIncome(req)));
  }),
);

router.delete(
  '/incomes/:id',
  h(async (req, res) => {
    const i = await ownIncome(req);
    if (i.user_id !== req.userId) throw forbidden('Solo quien anotó este ingreso puede borrarlo.');
    await query('DELETE FROM dbo.incomes WHERE id = @i', { i: i.id });
    res.status(204).end();
  }),
);

router.get(
  '/households/:id/categories',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const kind = req.query.kind === 'income' ? 'income' : 'expense';
    const rows = await query('SELECT id, household_id, kind, name, icon FROM dbo.categories WHERE household_id = @h AND kind = @k ORDER BY id', { h: hid, k: kind });
    res.json(rows.map((r) => ({ id: r.id, householdId: r.household_id, kind: r.kind, name: r.name, icon: r.icon ?? 'ellipsis-horizontal' })));
  }),
);

/** Medio de pago del mismo hogar (o null). Uno archivado solo se acepta si el gasto ya lo tenía. */
async function paymentMethodId(v, hid, keep) {
  if (v == null || v === '' || v === 0) return null;
  const id = num(v, 'El medio de pago', { min: 1, int: true });
  const [r] = await query('SELECT is_archived FROM dbo.payment_methods WHERE id = @i AND household_id = @h', { i: id, h: hid });
  if (!r || (r.is_archived && id !== keep)) throw badRequest('El medio de pago no es válido.');
  return id;
}

/** Persona dueña de un gasto personal (o null si es del hogar). Debe ser miembro. */
async function personalUserId(v, hid) {
  if (v == null || v === '' || v === 0) return null;
  const id = num(v, 'La persona', { min: 1, int: true });
  const [r] = await query('SELECT 1 AS x FROM dbo.household_members WHERE household_id = @h AND user_id = @u', { h: hid, u: id });
  if (!r) throw badRequest('Esa persona no es parte del hogar.');
  return id;
}

router.post(
  '/households/:id/expenses',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const amount = Number(req.body.amount);
    if (!(amount > 0) || amount > 1e10) throw badRequest('El monto debe ser mayor a cero.');
    const categoryId = num(req.body.categoryId, 'La categoría', { min: 1, int: true });
    const [cat] = await query('SELECT 1 AS x FROM dbo.categories WHERE id = @c AND household_id = @h', { c: categoryId, h: hid });
    if (!cat) throw badRequest('La categoría no es válida.');
    const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 200) : '';
    const spentOn = req.body.spentOn ? isoDate(req.body.spentOn, 'La fecha') : today();
    const pm = await paymentMethodId(req.body.paymentMethodId, hid);
    const pu = await personalUserId(req.body.personalUserId, hid);
    const [row] = await query(
      `INSERT INTO dbo.expenses (household_id, user_id, category_id, amount, description, spent_on, payment_method_id, personal_user_id)
       OUTPUT INSERTED.* VALUES (@h, @u, @c, @a, @d, @s, @pm, @pu)`,
      { h: hid, u: req.userId, c: categoryId, a: amount, d: description, s: date(spentOn), pm, pu },
    );
    res.status(201).json(expenseRow(row, true));
  }),
);

/** Un gasto lo cambia o borra quien lo anotó, o un administrador del hogar. */
async function editableExpense(req) {
  const eid = idParam(req);
  const [e] = await query('SELECT * FROM dbo.expenses WHERE id = @e', { e: eid });
  if (!e) throw notFound('No encontramos ese gasto.');
  const m = await requireMember(e.household_id, req.userId);
  return { e, canEdit: e.user_id === req.userId || m.role === 'admin' };
}

const expenseRow = (r, canEdit) => ({
  id: r.id,
  householdId: r.household_id,
  userId: r.user_id,
  categoryId: r.category_id,
  amount: Number(r.amount),
  description: r.description ?? '',
  spentOn: fromSql(r.spent_on),
  paymentMethodId: r.payment_method_id ?? undefined,
  personalUserId: r.personal_user_id ?? undefined,
  canEdit,
});

router.get(
  '/expenses/:id',
  h(async (req, res) => {
    const { e, canEdit } = await editableExpense(req);
    res.json(expenseRow(e, canEdit));
  }),
);

router.patch(
  '/expenses/:id',
  h(async (req, res) => {
    const { e, canEdit } = await editableExpense(req);
    if (!canEdit) throw forbidden('Solo quien anotó el gasto o un administrador puede cambiarlo.');
    const amount = Number(req.body.amount);
    if (!(amount > 0) || amount > 1e10) throw badRequest('El monto debe ser mayor a cero.');
    const categoryId = num(req.body.categoryId, 'La categoría', { min: 1, int: true });
    const [cat] = await query('SELECT 1 AS x FROM dbo.categories WHERE id = @c AND household_id = @h', { c: categoryId, h: e.household_id });
    if (!cat) throw badRequest('La categoría no es válida.');
    const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 200) : '';
    const spentOn = req.body.spentOn ? isoDate(req.body.spentOn, 'La fecha') : fromSql(e.spent_on);
    // Si la app no manda medio de pago ni persona (versión anterior), se mantienen los que tenía.
    const pm = 'paymentMethodId' in req.body ? await paymentMethodId(req.body.paymentMethodId, e.household_id, e.payment_method_id) : e.payment_method_id;
    const pu = 'personalUserId' in req.body ? await personalUserId(req.body.personalUserId, e.household_id) : e.personal_user_id;
    const [row] = await query(
      'UPDATE dbo.expenses SET amount = @a, category_id = @c, description = @d, spent_on = @s, payment_method_id = @pm, personal_user_id = @pu OUTPUT INSERTED.* WHERE id = @e',
      { e: e.id, a: amount, c: categoryId, d: description, s: date(spentOn), pm, pu },
    );
    res.json(expenseRow(row, true));
  }),
);

router.delete(
  '/expenses/:id',
  h(async (req, res) => {
    const { e, canEdit } = await editableExpense(req);
    if (!canEdit) throw forbidden('Solo quien anotó el gasto o un administrador puede borrarlo.');
    await query('DELETE FROM dbo.expenses WHERE id = @e', { e: e.id });
    res.status(204).end();
  }),
);

// ---------- Vehículos y propiedades ----------

const vehicleRow = (r) => ({
  id: r.id,
  householdId: r.household_id,
  name: r.name,
  plate: r.plate ?? undefined,
  model: r.model ?? undefined,
  year: r.year ?? undefined,
});

function vehicleInput(b) {
  const plate = typeof b.plate === 'string' ? b.plate.replace(/[\s.-]/g, '').toUpperCase() : '';
  if (plate.length > 10) throw badRequest('La patente es muy larga.');
  return {
    n: str(b.name, 'el nombre', { max: 100 }),
    pl: plate || null,
    m: b.model ? str(b.model, 'el modelo', { max: 100 }) : null,
    y: b.year == null || b.year === '' ? null : num(b.year, 'El año', { min: 1950, max: 2100, int: true }),
  };
}

async function vehicleOf(req) {
  const vid = idParam(req);
  const [v] = await query('SELECT * FROM dbo.vehicles WHERE id = @v', { v: vid });
  if (!v) throw notFound('No encontramos ese vehículo.');
  await requireMember(v.household_id, req.userId);
  return v;
}

/** Vehículos con sus papeles (permiso, revisión técnica, SOAP, seguro). */
router.get(
  '/households/:id/vehicles',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const vehicles = await query('SELECT * FROM dbo.vehicles WHERE household_id = @h ORDER BY id', { h: hid });
    const obligations = await obligationViews(hid);
    res.json(vehicles.map((v) => ({ ...vehicleRow(v), documents: obligations.filter((o) => o.vehicleId === v.id) })));
  }),
);

router.post(
  '/households/:id/vehicles',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const [row] = await query('INSERT INTO dbo.vehicles (household_id, name, plate, model, year) OUTPUT INSERTED.* VALUES (@h, @n, @pl, @m, @y)', {
      h: hid,
      ...vehicleInput(req.body),
    });
    res.status(201).json({ ...vehicleRow(row), documents: [] });
  }),
);

router.patch(
  '/vehicles/:id',
  h(async (req, res) => {
    const v = await vehicleOf(req);
    const [row] = await query('UPDATE dbo.vehicles SET name = @n, plate = @pl, model = @m, year = @y OUTPUT INSERTED.* WHERE id = @v', {
      v: v.id,
      ...vehicleInput(req.body),
    });
    res.json(vehicleRow(row));
  }),
);

/** Borra el vehículo. Sus papeles quedan como cuentas sueltas, con su historial. */
router.delete(
  '/vehicles/:id',
  h(async (req, res) => {
    const v = await vehicleOf(req);
    await transaction(async (tx) => {
      await query('UPDATE dbo.obligations SET vehicle_id = NULL WHERE vehicle_id = @v', { v: v.id }, tx);
      await query('DELETE FROM dbo.vehicles WHERE id = @v', { v: v.id }, tx);
    });
    res.status(204).end();
  }),
);

const propertyRow = (r) => ({ id: r.id, householdId: r.household_id, name: r.name, address: r.address ?? undefined });

function propertyInput(b) {
  return { n: str(b.name, 'el nombre', { max: 100 }), ad: b.address ? str(b.address, 'la dirección', { max: 200 }) : null };
}

async function propertyOf(req) {
  const pid = idParam(req);
  const [p] = await query('SELECT * FROM dbo.properties WHERE id = @p', { p: pid });
  if (!p) throw notFound('No encontramos esa propiedad.');
  await requireMember(p.household_id, req.userId);
  return p;
}

/**
 * Propiedades con su dividendo (obligaciones ligadas) y su arriendo (fuentes de ingreso ligadas), más lo pagado
 * y recibido este mes. El arriendo privado de otra persona no se ve ni se suma.
 */
router.get(
  '/households/:id/properties',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const t = today();
    const p = { h: hid, u: req.userId, from: date(monthStart(t)), to: date(nextMonthStart(t)) };
    const props = await query('SELECT * FROM dbo.properties WHERE household_id = @h ORDER BY id', p);
    const obligations = await obligationViews(hid);
    const sources = await query('SELECT * FROM dbo.income_sources WHERE household_id = @h AND property_id IS NOT NULL AND (is_private = 0 OR user_id = @u)', p);
    const rent = await query(
      `SELECT s.property_id, SUM(i.amount) AS s FROM dbo.incomes i JOIN dbo.income_sources s ON s.id = i.source_id
        WHERE i.household_id = @h AND s.property_id IS NOT NULL AND ${VISIBLE_INCOME} AND i.received_on >= @from AND i.received_on < @to
        GROUP BY s.property_id`,
      p,
    );
    const paid = await query(
      `SELECT o.property_id, SUM(op.amount_clp) AS s FROM dbo.obligation_payments op JOIN dbo.obligations o ON o.id = op.obligation_id
        WHERE o.household_id = @h AND o.property_id IS NOT NULL AND op.paid_on >= @from AND op.paid_on < @to
        GROUP BY o.property_id`,
      p,
    );
    res.json(
      props.map((r) => ({
        ...propertyRow(r),
        mortgages: obligations.filter((o) => o.propertyId === r.id),
        rentSources: sources.filter((s) => s.property_id === r.id).map(incomeSourceRow),
        rentThisMonth: Number(rent.find((x) => x.property_id === r.id)?.s ?? 0),
        mortgagePaidThisMonth: Number(paid.find((x) => x.property_id === r.id)?.s ?? 0),
      })),
    );
  }),
);

router.post(
  '/households/:id/properties',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const [row] = await query('INSERT INTO dbo.properties (household_id, name, address) OUTPUT INSERTED.* VALUES (@h, @n, @ad)', { h: hid, ...propertyInput(req.body) });
    res.status(201).json(propertyRow(row));
  }),
);

router.patch(
  '/properties/:id',
  h(async (req, res) => {
    const p = await propertyOf(req);
    const [row] = await query('UPDATE dbo.properties SET name = @n, address = @ad OUTPUT INSERTED.* WHERE id = @p', { p: p.id, ...propertyInput(req.body) });
    res.json(propertyRow(row));
  }),
);

/** Borra la propiedad. Su dividendo y su arriendo quedan como cuentas e ingresos sueltos, con su historial. */
router.delete(
  '/properties/:id',
  h(async (req, res) => {
    const p = await propertyOf(req);
    await transaction(async (tx) => {
      await query('UPDATE dbo.obligations SET property_id = NULL WHERE property_id = @p', { p: p.id }, tx);
      await query('UPDATE dbo.income_sources SET property_id = NULL WHERE property_id = @p', { p: p.id }, tx);
      await query('DELETE FROM dbo.properties WHERE id = @p', { p: p.id }, tx);
    });
    res.status(204).end();
  }),
);

// ---------- Tareas ----------

const periodStart = (frequency) => (frequency === 'daily' ? today() : weekStart(today()));

router.get(
  '/households/:id/routines',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const p = { h: hid, d: date(today()), w: date(weekStart(today())) };
    const rows = await query(
      `SELECT r.id, r.household_id, r.name, r.frequency, r.points, c.user_id AS done_by
         FROM dbo.routines r
         LEFT JOIN dbo.routine_checks c ON c.routine_id = r.id AND c.period_start = IIF(r.frequency = 'daily', @d, @w)
        WHERE r.household_id = @h ORDER BY r.frequency, r.id`,
      p,
    );
    res.json(rows.map((r) => ({ id: r.id, householdId: r.household_id, name: r.name, frequency: r.frequency, points: r.points, doneBy: r.done_by ?? undefined })));
  }),
);

router.post(
  '/households/:id/routines',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const frequency = req.body.frequency === 'weekly' ? 'weekly' : 'daily';
    const [row] = await query(
      'INSERT INTO dbo.routines (household_id, name, frequency, points) OUTPUT INSERTED.* VALUES (@h, @n, @f, @p)',
      { h: hid, n: str(req.body.name, 'el nombre', { max: 100 }), f: frequency, p: num(req.body.points ?? 1, 'Los puntos', { min: 1, max: 13, int: true }) },
    );
    res.status(201).json({ id: row.id, householdId: hid, name: row.name, frequency: row.frequency, points: row.points });
  }),
);

router.post(
  '/routines/:id/toggle',
  h(async (req, res) => {
    const rid = idParam(req);
    const [r] = await query('SELECT household_id, frequency FROM dbo.routines WHERE id = @r', { r: rid });
    if (!r) throw notFound('No encontramos esa rutina.');
    await requireMember(r.household_id, req.userId);
    const p = { r: rid, d: date(periodStart(r.frequency)), u: req.userId };
    const deleted = await query('DELETE FROM dbo.routine_checks OUTPUT DELETED.routine_id WHERE routine_id = @r AND period_start = @d', p);
    if (!deleted.length) {
      try {
        await query('INSERT INTO dbo.routine_checks (routine_id, period_start, user_id) VALUES (@r, @d, @u)', p);
      } catch (e) {
        if (e.number !== 2627) throw e; // otra persona la marcó al mismo tiempo: queda marcada
      }
    }
    res.status(204).end();
  }),
);

async function routineOf(req) {
  const rid = idParam(req);
  const [r] = await query('SELECT * FROM dbo.routines WHERE id = @r', { r: rid });
  if (!r) throw notFound('No encontramos esa rutina.');
  await requireMember(r.household_id, req.userId);
  return r;
}

router.patch(
  '/routines/:id',
  h(async (req, res) => {
    const r = await routineOf(req);
    const frequency = req.body.frequency === 'weekly' ? 'weekly' : 'daily';
    const [row] = await query('UPDATE dbo.routines SET name = @n, frequency = @f, points = @p OUTPUT INSERTED.* WHERE id = @r', {
      r: r.id,
      n: str(req.body.name, 'el nombre', { max: 100 }),
      f: frequency,
      p: num(req.body.points ?? 1, 'Los puntos', { min: 1, max: 13, int: true }),
    });
    res.json({ id: row.id, householdId: row.household_id, name: row.name, frequency: row.frequency, points: row.points });
  }),
);

/** Borra la rutina y sus marcas (sus puntos salen del ranking). */
router.delete(
  '/routines/:id',
  h(async (req, res) => {
    const r = await routineOf(req);
    await transaction(async (tx) => {
      await query('DELETE FROM dbo.routine_checks WHERE routine_id = @r', { r: r.id }, tx);
      await query('DELETE FROM dbo.routines WHERE id = @r', { r: r.id }, tx);
    });
    res.status(204).end();
  }),
);

export const FIBONACCI = [1, 2, 3, 5, 8, 13];

router.get(
  '/households/:id/backlog',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const tasks = await query('SELECT * FROM dbo.backlog_tasks WHERE household_id = @h ORDER BY id', { h: hid });
    const votes = await query(
      'SELECT v.task_id, v.user_id, v.points FROM dbo.task_votes v JOIN dbo.backlog_tasks t ON t.id = v.task_id WHERE t.household_id = @h',
      { h: hid },
    );
    const [{ n: members }] = await query('SELECT COUNT(*) AS n FROM dbo.household_members WHERE household_id = @h', { h: hid });
    res.json(
      tasks.map((t) => {
        const tv = votes.filter((v) => v.task_id === t.id).map((v) => ({ taskId: v.task_id, userId: v.user_id, points: v.points }));
        return {
          id: t.id,
          householdId: t.household_id,
          title: t.title,
          status: t.status,
          points: t.points ?? undefined,
          takenBy: t.taken_by ?? undefined,
          doneOn: fromSql(t.done_on),
          votes: tv,
          myVote: tv.find((v) => v.userId === req.userId)?.points,
          pendingVoters: Math.max(0, members - tv.length),
        };
      }),
    );
  }),
);

router.post(
  '/households/:id/backlog',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    await query('INSERT INTO dbo.backlog_tasks (household_id, title) VALUES (@h, @t)', { h: hid, t: str(req.body.title, 'el título', { min: 3, max: 150 }) });
    res.status(201).end();
  }),
);

async function backlogTask(req) {
  const tid = idParam(req);
  const [t] = await query('SELECT * FROM dbo.backlog_tasks WHERE id = @t', { t: tid });
  if (!t) throw notFound('No encontramos esa tarea.');
  await requireMember(t.household_id, req.userId);
  return t;
}

/** Planning poker: cuando votaron todos los miembros, queda el voto más alto. */
router.post(
  '/backlog/:id/vote',
  h(async (req, res) => {
    const t = await backlogTask(req);
    if (t.status !== 'estimating') throw conflict('Esta tarea ya no está en votación.');
    const points = Number(req.body.points);
    if (!FIBONACCI.includes(points)) throw badRequest('El voto debe ser 1, 2, 3, 5, 8 o 13.');
    await transaction(async (tx) => {
      const p = { t: t.id, u: req.userId, p: points, h: t.household_id };
      await query(
        `MERGE dbo.task_votes WITH (HOLDLOCK) AS v USING (SELECT @t AS task_id, @u AS user_id) s
            ON v.task_id = s.task_id AND v.user_id = s.user_id
          WHEN MATCHED THEN UPDATE SET points = @p, voted_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (task_id, user_id, points) VALUES (@t, @u, @p);`,
        p,
        tx,
      );
      await query(
        `UPDATE dbo.backlog_tasks SET status = 'open', points = (SELECT MAX(points) FROM dbo.task_votes WHERE task_id = @t)
          WHERE id = @t AND status = 'estimating'
            AND (SELECT COUNT(*) FROM dbo.task_votes WHERE task_id = @t) >= (SELECT COUNT(*) FROM dbo.household_members WHERE household_id = @h)`,
        p,
        tx,
      );
    });
    res.status(204).end();
  }),
);

router.post(
  '/backlog/:id/take',
  h(async (req, res) => {
    const t = await backlogTask(req);
    const updated = await query("UPDATE dbo.backlog_tasks SET status = 'taken', taken_by = @u OUTPUT INSERTED.id WHERE id = @t AND status = 'open'", { t: t.id, u: req.userId });
    if (!updated.length) throw conflict('Alguien ya tomó esta tarea.');
    res.status(204).end();
  }),
);

router.post(
  '/backlog/:id/complete',
  h(async (req, res) => {
    const t = await backlogTask(req);
    const updated = await query(
      "UPDATE dbo.backlog_tasks SET status = 'done', done_on = @d OUTPUT INSERTED.id WHERE id = @t AND status = 'taken' AND taken_by = @u",
      { t: t.id, u: req.userId, d: date(today()) },
    );
    if (!updated.length) throw forbidden('Solo quien tomó la tarea puede cerrarla.');
    res.status(204).end();
  }),
);

router.patch(
  '/backlog/:id',
  h(async (req, res) => {
    const t = await backlogTask(req);
    await query('UPDATE dbo.backlog_tasks SET title = @title WHERE id = @t', { t: t.id, title: str(req.body.title, 'el título', { min: 3, max: 150 }) });
    res.status(204).end();
  }),
);

/** Borra la tarea y sus votos. Si ya estaba terminada, sus puntos salen del ranking. */
router.delete(
  '/backlog/:id',
  h(async (req, res) => {
    const t = await backlogTask(req);
    await transaction(async (tx) => {
      await query('DELETE FROM dbo.task_votes WHERE task_id = @t', { t: t.id }, tx);
      await query('DELETE FROM dbo.backlog_tasks WHERE id = @t', { t: t.id }, tx);
    });
    res.status(204).end();
  }),
);

/** Puntos de la semana: rutinas marcadas + tareas del backlog terminadas. */
router.get(
  '/households/:id/ranking',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const rows = await query(
      `SELECT u.id, u.email, u.username, u.display_name, m.role,
              ISNULL((SELECT SUM(r.points) FROM dbo.routine_checks c JOIN dbo.routines r ON r.id = c.routine_id
                       WHERE r.household_id = @h AND c.user_id = u.id AND c.period_start >= @w), 0)
            + ISNULL((SELECT SUM(b.points) FROM dbo.backlog_tasks b
                       WHERE b.household_id = @h AND b.status = 'done' AND b.taken_by = u.id AND b.done_on >= @w), 0) AS points
         FROM dbo.household_members m JOIN dbo.users u ON u.id = m.user_id
        WHERE m.household_id = @h
        ORDER BY points DESC, m.joined_at`,
      { h: hid, w: date(weekStart(today())) },
    );
    res.json(rows.map((r) => ({ user: { ...publicUser(r), role: r.role }, points: r.points })));
  }),
);

// ---------- Medios de pago, ahorro y cierre del mes (migración 0004) ----------

const METHOD_KINDS = ['credit', 'debit', 'cash'];

const methodRow = (r) => ({
  id: r.id,
  householdId: r.household_id,
  ownerUserId: r.owner_user_id,
  ownerName: r.owner_name ?? undefined,
  kind: r.kind,
  name: r.name,
  cutDay: r.cut_day ?? undefined,
  dueDay: r.due_day ?? undefined,
  isArchived: Boolean(r.is_archived),
});

const METHOD_SELECT = `SELECT pm.*, u.display_name AS owner_name FROM dbo.payment_methods pm JOIN dbo.users u ON u.id = pm.owner_user_id`;

async function methodOf(req) {
  const id = idParam(req);
  const [m] = await query(`${METHOD_SELECT} WHERE pm.id = @i`, { i: id });
  if (!m) throw notFound('No encontramos ese medio de pago.');
  await requireMember(m.household_id, req.userId);
  return m;
}

async function methodInput(b, hid, kind) {
  const owner = b.ownerUserId == null || b.ownerUserId === '' ? null : await personalUserId(b.ownerUserId, hid);
  const credit = kind === 'credit';
  return {
    n: str(b.name, 'el nombre', { max: 100 }),
    o: owner,
    cd: credit ? num(b.cutDay, 'El día de corte', { min: 1, max: 31, int: true }) : null,
    dd: credit ? num(b.dueDay, 'El día de vencimiento', { min: 1, max: 31, int: true }) : null,
  };
}

router.get(
  '/households/:id/payment-methods',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const all = req.query.all === '1';
    const rows = await query(
      `${METHOD_SELECT} WHERE pm.household_id = @h ${all ? '' : 'AND pm.is_archived = 0'}
        ORDER BY CASE pm.kind WHEN 'credit' THEN 0 WHEN 'debit' THEN 1 ELSE 2 END, pm.id`,
      { h: hid },
    );
    res.json(rows.map(methodRow));
  }),
);

router.post(
  '/households/:id/payment-methods',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const kind = req.body.kind;
    if (!METHOD_KINDS.includes(kind)) throw badRequest('El tipo de medio de pago no es válido.');
    const input = await methodInput(req.body, hid, kind);
    const row = await transaction(async (tx) => {
      const [r] = await query(
        'INSERT INTO dbo.payment_methods (household_id, owner_user_id, kind, name, cut_day, due_day) OUTPUT INSERTED.id VALUES (@h, @o, @k, @n, @cd, @dd)',
        { h: hid, k: kind, ...input, o: input.o ?? req.userId },
        tx,
      );
      // La primera tarjeta de crédito fija el ciclo del hogar (del día siguiente al corte hasta el corte).
      if (kind === 'credit') {
        await query('UPDATE dbo.households SET cycle_cut_day = @cd WHERE id = @h AND cycle_cut_day IS NULL', { h: hid, cd: input.cd }, tx);
      }
      const [full] = await query(`${METHOD_SELECT} WHERE pm.id = @i`, { i: r.id }, tx);
      return full;
    });
    res.status(201).json(methodRow(row));
  }),
);

router.patch(
  '/payment-methods/:id',
  h(async (req, res) => {
    const m = await methodOf(req);
    const input = await methodInput(req.body, m.household_id, m.kind);
    await query('UPDATE dbo.payment_methods SET name = @n, owner_user_id = @o, cut_day = @cd, due_day = @dd WHERE id = @i', {
      i: m.id,
      ...input,
      o: input.o ?? m.owner_user_id,
    });
    const [row] = await query(`${METHOD_SELECT} WHERE pm.id = @i`, { i: m.id });
    res.json(methodRow(row));
  }),
);

/** Si ya se usó, se archiva (los gastos guardan de dónde salió la plata); si no, se borra. */
router.delete(
  '/payment-methods/:id',
  h(async (req, res) => {
    const m = await methodOf(req);
    const [used] = await query(
      `SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.expenses WHERE payment_method_id = @i)
                     OR EXISTS (SELECT 1 FROM dbo.obligation_payments WHERE payment_method_id = @i)
                     OR EXISTS (SELECT 1 FROM dbo.card_payments WHERE payment_method_id = @i) THEN 1 ELSE 0 END AS used`,
      { i: m.id },
    );
    await transaction(async (tx) => {
      await query('UPDATE dbo.obligations SET payment_method_id = NULL WHERE payment_method_id = @i', { i: m.id }, tx);
      if (used.used) await query('UPDATE dbo.payment_methods SET is_archived = 1 WHERE id = @i', { i: m.id }, tx);
      else await query('DELETE FROM dbo.payment_methods WHERE id = @i', { i: m.id }, tx);
    });
    res.status(204).end();
  }),
);

/** Cargos de una tarjeta en un estado de cuenta: gastos y cuentas pagadas con ella entre el inicio y el corte. */
async function cardCharges(methodId, st) {
  const p = { m: methodId, from: date(st.start), to: date(st.end) };
  const expenses = await query(
    `SELECT e.id, e.amount, e.spent_on, e.description, c.name AS category, pu.display_name AS personal_name
       FROM dbo.expenses e JOIN dbo.categories c ON c.id = e.category_id LEFT JOIN dbo.users pu ON pu.id = e.personal_user_id
      WHERE e.payment_method_id = @m AND e.spent_on BETWEEN @from AND @to`,
    p,
  );
  const bills = await query(
    `SELECT p.id, p.obligation_id, p.amount_clp, p.paid_on, o.name
       FROM dbo.obligation_payments p JOIN dbo.obligations o ON o.id = p.obligation_id
      WHERE p.payment_method_id = @m AND p.paid_on BETWEEN @from AND @to`,
    p,
  );
  const rows = [
    ...expenses.map((r) => ({
      key: `e${r.id}`,
      id: r.id,
      kind: 'expense',
      title: r.description || r.category,
      subtitle: r.personal_name ? `${r.category} · Personal de ${String(r.personal_name).split(' ')[0]}` : r.category,
      amount: Number(r.amount),
      date: fromSql(r.spent_on),
    })),
    ...bills.map((r) => ({ key: `p${r.id}`, id: r.id, obligationId: r.obligation_id, kind: 'payment', title: r.name, subtitle: 'Pago de cuenta', amount: Number(r.amount_clp), date: fromSql(r.paid_on) })),
  ];
  rows.sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));
  return rows;
}

async function cardPaymentsFor(methodId, statementEnd) {
  return query(
    `SELECT cp.id, cp.amount, cp.paid_on, cp.user_id, u.display_name FROM dbo.card_payments cp JOIN dbo.users u ON u.id = cp.user_id
      WHERE cp.payment_method_id = @m AND cp.statement_end = @s ORDER BY cp.paid_on, cp.id`,
    { m: methodId, s: date(statementEnd) },
  );
}

function statementView(m, st, charges, payments) {
  const charged = charges.reduce((s, c) => s + c.amount, 0);
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  return {
    methodId: m.id,
    name: m.name,
    ownerUserId: m.owner_user_id,
    ownerName: m.owner_name,
    start: st.start,
    end: st.end,
    label: cycleLabel(st),
    dueOn: dueDateOf(st.end, m.due_day),
    isClosed: st.end < today(),
    charged,
    paid,
    pending: Math.max(0, charged - paid),
  };
}

/**
 * Estado de cuenta de una tarjeta según la app ("facturado según la app"), para compararlo con el del banco.
 * ?end=YYYY-MM-DD elige el corte; por defecto, el último corte que ya pasó.
 */
router.get(
  '/payment-methods/:id/statement',
  h(async (req, res) => {
    const m = await methodOf(req);
    if (m.kind !== 'credit') throw badRequest('Solo las tarjetas de crédito tienen estado de cuenta.');
    const st = req.query.end ? cycleOf(isoDate(req.query.end, 'El corte'), m.cut_day) : statementPaidOn(today(), m.cut_day);
    const charges = await cardCharges(m.id, st);
    const payments = await cardPaymentsFor(m.id, st.end);
    res.json({
      ...statementView(m, st, charges, payments),
      prevEnd: previousCycle(st, m.cut_day).end,
      nextEnd: nextCycle(st, m.cut_day).end,
      charges,
      payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), paidOn: fromSql(p.paid_on), userId: p.user_id, paidBy: p.display_name })),
    });
  }),
);

/** Pagar la tarjeta: pago de deuda, no gasto. Cuenta como aporte de quien paga. */
router.post(
  '/payment-methods/:id/payments',
  h(async (req, res) => {
    const m = await methodOf(req);
    if (m.kind !== 'credit') throw badRequest('Solo se pagan las tarjetas de crédito.');
    const paidOn = req.body.paidOn ? isoDate(req.body.paidOn, 'La fecha') : today();
    const statementEnd = req.body.statementEnd ? cycleOf(isoDate(req.body.statementEnd, 'El corte'), m.cut_day).end : statementPaidOn(paidOn, m.cut_day).end;
    const payer = req.body.userId ? await personalUserId(req.body.userId, m.household_id) : req.userId;
    const [row] = await query(
      'INSERT INTO dbo.card_payments (payment_method_id, user_id, amount, paid_on, statement_end) OUTPUT INSERTED.id VALUES (@m, @u, @a, @d, @s)',
      { m: m.id, u: payer, a: num(req.body.amount, 'El monto', { min: 1 }), d: date(paidOn), s: date(statementEnd) },
    );
    res.status(201).json({ id: row.id, statementEnd });
  }),
);

router.delete(
  '/card-payments/:id',
  h(async (req, res) => {
    const id = idParam(req);
    const [p] = await query('SELECT cp.id, cp.user_id, pm.household_id FROM dbo.card_payments cp JOIN dbo.payment_methods pm ON pm.id = cp.payment_method_id WHERE cp.id = @i', { i: id });
    if (!p) throw notFound('No encontramos ese pago.');
    const m = await requireMember(p.household_id, req.userId);
    if (p.user_id !== req.userId && m.role !== 'admin') throw forbidden('Solo quien pagó o un administrador puede borrar este pago.');
    await query('DELETE FROM dbo.card_payments WHERE id = @i', { i: id });
    res.status(204).end();
  }),
);

// Ajustes del mes: corte del ciclo, meta de ahorro y % de cada uno.

async function householdFinance(hid) {
  const [hh] = await query('SELECT cycle_cut_day, savings_goal FROM dbo.households WHERE id = @h', { h: hid });
  const members = await query(
    `SELECT u.id, u.display_name, m.share_pct FROM dbo.household_members m JOIN dbo.users u ON u.id = m.user_id
      WHERE m.household_id = @h ORDER BY m.joined_at`,
    { h: hid },
  );
  // El sueldo de cada uno: monto habitual de sus fuentes, sin arriendos. Las privadas cuentan, pero solo se muestra el %.
  const incomes = await query(
    'SELECT user_id, SUM(expected_amount) AS s FROM dbo.income_sources WHERE household_id = @h AND property_id IS NULL GROUP BY user_id',
    { h: hid },
  );
  const ms = members.map((r) => ({ userId: r.id, name: r.display_name, sharePct: r.share_pct == null ? null : Number(r.share_pct) }));
  const { source, shares } = computeShares(ms, Object.fromEntries(incomes.map((r) => [r.user_id, Number(r.s)])));
  return {
    cycleCutDay: hh.cycle_cut_day ?? undefined,
    savingsGoal: Number(hh.savings_goal ?? 0),
    shareSource: source,
    members: ms.map((m) => ({ ...m, sharePct: m.sharePct ?? undefined, share: Math.round((shares[m.userId] ?? 0) * 1000) / 10 })),
    shares,
  };
}

const financeView = ({ shares: _s, ...rest }) => rest;

router.get(
  '/households/:id/finance-settings',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    res.json(financeView(await householdFinance(hid)));
  }),
);

/** { cycleCutDay (null = mes calendario), savingsGoal, shares: [{ userId, pct }] o null para calcular por sueldos }. */
router.patch(
  '/households/:id/finance-settings',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const b = req.body;
    const cut = b.cycleCutDay == null || b.cycleCutDay === '' ? null : num(b.cycleCutDay, 'El día de corte', { min: 1, max: 31, int: true });
    const goal = num(b.savingsGoal ?? 0, 'La meta de ahorro', { max: 1e10 });
    let shares = null;
    if (Array.isArray(b.shares)) {
      shares = b.shares.map((s) => ({ u: num(s.userId, 'La persona', { min: 1, int: true }), p: num(s.pct, 'El porcentaje', { max: 100 }) }));
      const total = shares.reduce((s, x) => s + x.p, 0);
      if (Math.abs(total - 100) > 0.5) throw badRequest('Los porcentajes deben sumar 100.');
    }
    await transaction(async (tx) => {
      await query('UPDATE dbo.households SET cycle_cut_day = @c, savings_goal = @g, updated_at = SYSUTCDATETIME() WHERE id = @h', { h: hid, c: cut, g: goal }, tx);
      if ('shares' in b) {
        await query('UPDATE dbo.household_members SET share_pct = NULL WHERE household_id = @h', { h: hid }, tx);
        for (const s of shares ?? []) {
          await query('UPDATE dbo.household_members SET share_pct = @p WHERE household_id = @h AND user_id = @u', { h: hid, u: s.u, p: s.p }, tx);
        }
      }
    });
    res.json(financeView(await householdFinance(hid)));
  }),
);

// Ahorro en común.

router.get(
  '/households/:id/savings',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const [hh] = await query('SELECT savings_goal FROM dbo.households WHERE id = @h', { h: hid });
    const [total] = await query('SELECT ISNULL(SUM(amount), 0) AS s FROM dbo.savings_deposits WHERE household_id = @h', { h: hid });
    const rows = await query(
      `SELECT TOP 30 d.id, d.user_id, d.amount, d.deposited_on, d.note, u.display_name
         FROM dbo.savings_deposits d JOIN dbo.users u ON u.id = d.user_id
        WHERE d.household_id = @h ORDER BY d.deposited_on DESC, d.id DESC`,
      { h: hid },
    );
    res.json({
      goal: Number(hh.savings_goal ?? 0),
      total: Number(total.s),
      deposits: rows.map((r) => ({ id: r.id, userId: r.user_id, depositedBy: r.display_name, amount: Number(r.amount), depositedOn: fromSql(r.deposited_on), note: r.note })),
    });
  }),
);

router.post(
  '/households/:id/savings',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const depositedOn = req.body.depositedOn ? isoDate(req.body.depositedOn, 'La fecha') : today();
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : '';
    const [row] = await query(
      'INSERT INTO dbo.savings_deposits (household_id, user_id, amount, deposited_on, note) OUTPUT INSERTED.id VALUES (@h, @u, @a, @d, @n)',
      { h: hid, u: req.userId, a: num(req.body.amount, 'El monto', { min: 1 }), d: date(depositedOn), n: note },
    );
    res.status(201).json({ id: row.id });
  }),
);

router.delete(
  '/savings-deposits/:id',
  h(async (req, res) => {
    const id = idParam(req);
    const [d] = await query('SELECT id, user_id, household_id FROM dbo.savings_deposits WHERE id = @i', { i: id });
    if (!d) throw notFound('No encontramos ese depósito.');
    const m = await requireMember(d.household_id, req.userId);
    if (d.user_id !== req.userId && m.role !== 'admin') throw forbidden('Solo quien depositó o un administrador puede borrarlo.');
    await query('DELETE FROM dbo.savings_deposits WHERE id = @i', { i: id });
    res.status(204).end();
  }),
);

// Cierre del mes.

/** Quién puso la plata de un gasto o pago: con crédito nadie todavía; con débito o efectivo, su dueño; sin medio, quien lo anotó. */
const payerOf = (r) => (r.method_kind === 'credit' ? null : r.method_kind ? r.owner_user_id : r.user_id);

async function closingFor(hid, cycleEnd) {
  const fin = await householdFinance(hid);
  const cycle = cycleOf(cycleEnd ?? today(), fin.cycleCutDay ?? null);
  const p = { h: hid, from: date(cycle.start), to: date(cycle.end) };

  const expenses = await query(
    `SELECT e.amount, e.user_id, e.personal_user_id, pm.kind AS method_kind, pm.owner_user_id
       FROM dbo.expenses e LEFT JOIN dbo.payment_methods pm ON pm.id = e.payment_method_id
      WHERE e.household_id = @h AND e.spent_on BETWEEN @from AND @to`,
    p,
  );
  const bills = await query(
    `SELECT p.amount_clp AS amount, p.user_id, pm.kind AS method_kind, pm.owner_user_id
       FROM dbo.obligation_payments p JOIN dbo.obligations o ON o.id = p.obligation_id LEFT JOIN dbo.payment_methods pm ON pm.id = p.payment_method_id
      WHERE o.household_id = @h AND p.paid_on BETWEEN @from AND @to`,
    p,
  );
  const deposits = await query(
    'SELECT user_id, SUM(amount) AS s FROM dbo.savings_deposits WHERE household_id = @h AND deposited_on BETWEEN @from AND @to GROUP BY user_id',
    p,
  );
  const [savingsAll] = await query('SELECT ISNULL(SUM(amount), 0) AS s FROM dbo.savings_deposits WHERE household_id = @h', { h: hid });
  const cardsRaw = await query(`${METHOD_SELECT} WHERE pm.household_id = @h AND pm.kind = 'credit'`, { h: hid });

  const paid = {};
  const add = (uid, field, amount) => {
    if (uid == null) return;
    paid[uid] ??= { expenses: 0, cardPayments: 0, savings: 0 };
    paid[uid][field] += amount;
  };
  const personal = {};
  let household = 0;
  let byCredit = 0;
  for (const e of expenses) {
    const a = Number(e.amount);
    if (e.personal_user_id) personal[e.personal_user_id] = (personal[e.personal_user_id] ?? 0) + a;
    else household += a;
    if (e.method_kind === 'credit') byCredit += a;
    add(payerOf(e), 'expenses', a);
  }
  for (const b of bills) {
    const a = Number(b.amount);
    household += a;
    if (b.method_kind === 'credit') byCredit += a;
    add(payerOf(b), 'expenses', a);
  }
  for (const d of deposits) add(d.user_id, 'savings', Number(d.s));

  // Cada tarjeta: el estado que corta dentro de este ciclo, lo cargado según la app y lo pagado para ese estado.
  const cards = [];
  for (const m of cardsRaw) {
    const st = cardStatementIn(cycle, m.cut_day);
    const charges = await cardCharges(m.id, st);
    const payments = await cardPaymentsFor(m.id, st.end);
    if (m.is_archived && !charges.length && !payments.length) continue;
    for (const cp of payments) add(cp.user_id, 'cardPayments', Number(cp.amount));
    cards.push(statementView(m, st, charges, payments));
  }

  const savingsDeposited = deposits.reduce((s, d) => s + Number(d.s), 0);
  const result = computeClosing({
    members: fin.members,
    shares: fin.shares,
    household,
    personal,
    paid,
    cards: cards.map((c) => ({ ownerUserId: c.ownerUserId, pending: c.pending })),
    savingsGoal: fin.savingsGoal,
    savingsDeposited,
  });
  const names = Object.fromEntries(fin.members.map((m) => [m.userId, m.name]));
  const [closed] = await query(
    `SELECT c.closed_at, c.snapshot, u.display_name FROM dbo.month_closings c JOIN dbo.users u ON u.id = c.closed_by
      WHERE c.household_id = @h AND c.cycle_end = @e`,
    { h: hid, e: date(cycle.end) },
  );
  const t = today();
  return {
    cycle: { ...cycle, label: cycleLabel(cycle), cutDay: fin.cycleCutDay, hasEnded: cycle.end < t, isCurrent: cycle.start <= t && t <= cycle.end },
    prevEnd: previousCycle(cycle, fin.cycleCutDay ?? null).end,
    nextEnd: nextCycle(cycle, fin.cycleCutDay ?? null).end,
    shareSource: fin.shareSource,
    totals: {
      household: Math.round(household),
      personal: Math.round(Object.values(personal).reduce((s, x) => s + x, 0)),
      byCredit: Math.round(byCredit),
      savingsGoal: fin.savingsGoal,
      savingsDeposited: Math.round(savingsDeposited),
      savingsTotal: Number(savingsAll.s),
    },
    pendingCard: result.pendingCard,
    savingsShortfall: result.savingsShortfall,
    isFinal: result.isFinal,
    members: result.members.map((m) => ({ ...m, name: names[m.userId] })),
    cards,
    transfers: result.transfers.map((x) => ({ ...x, fromName: names[x.fromUserId], toName: names[x.toUserId] })),
    closed: closed
      ? { closedAt: closed.closed_at.toISOString(), closedBy: closed.display_name, transfers: JSON.parse(closed.snapshot).transfers ?? [] }
      : undefined,
  };
}

/** Cierre del ciclo que contiene ?end=YYYY-MM-DD (por defecto, el ciclo de hoy). */
router.get(
  '/households/:id/closing',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    res.json(await closingFor(hid, req.query.end ? isoDate(req.query.end, 'La fecha') : undefined));
  }),
);

/** Marca las transferencias como hechas y cierra el ciclo, guardando la foto de cómo quedó. */
router.post(
  '/households/:id/closings',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const c = await closingFor(hid, isoDate(req.body.cycleEnd, 'El ciclo'));
    if (!c.cycle.hasEnded) throw badRequest(`El mes del hogar termina el ${formatShortDate(c.cycle.end)}. Ciérralo después de esa fecha.`);
    if (c.closed) throw conflict('Este mes ya está cerrado.');
    const snapshot = JSON.stringify({ totals: c.totals, members: c.members, cards: c.cards, transfers: c.transfers, isFinal: c.isFinal });
    await query('INSERT INTO dbo.month_closings (household_id, cycle_end, closed_by, snapshot) VALUES (@h, @e, @u, @s)', {
      h: hid,
      e: date(c.cycle.end),
      u: req.userId,
      s: snapshot,
    });
    res.status(201).json(await closingFor(hid, c.cycle.end));
  }),
);

/** Reabre un mes cerrado por error. */
router.delete(
  '/households/:id/closings/:end',
  h(async (req, res) => {
    const hid = idParam(req);
    await requireMember(hid, req.userId);
    const end = isoDate(req.params.end, 'El ciclo');
    await query('DELETE FROM dbo.month_closings WHERE household_id = @h AND cycle_end = @e', { h: hid, e: date(end) });
    res.status(204).end();
  }),
);
