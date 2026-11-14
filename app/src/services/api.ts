import { addMonths, daysUntil, formatShortDate, isSameMonth, today, weekStart } from '../utils/dates';
import { DEFAULT_EXPENSE_CATEGORIES, UF_VALUE, db, newId } from './mockDb';
import type {
  BacklogTaskView,
  Category,
  Expense,
  Frequency,
  IncomeSource,
  Member,
  MonthSummary,
  Movement,
  MyHousehold,
  ObligationView,
  RankingRow,
  Routine,
  User,
} from './types';

/**
 * API simulada. Cada función imita lo que hará la API real (latencia incluida) para que las
 * pantallas ya manejen carga y error. Al conectar Azure solo cambia este archivo.
 */

const LATENCY_MS = 350;

export class ApiError extends Error {}

function delay<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, LATENCY_MS),
  );
}

function publicUser(u: User): User {
  return { id: u.id, email: u.email, username: u.username, displayName: u.displayName };
}

function requireMember(householdId: number, userId: number) {
  const m = db.memberships.find((x) => x.householdId === householdId && x.userId === userId);
  if (!m) throw new ApiError('No perteneces a este hogar.');
  return m;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newInviteCode() {
  let code = '';
  do {
    code = Array.from({ length: 8 }, () => INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]).join('');
  } while (db.households.some((h) => h.inviteCode === code));
  return code;
}

/** Normaliza lo que escribe la persona: sin espacios ni guiones, en mayúscula. */
export function normalizeInviteCode(raw: string) {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

// ---------- Acceso ----------

export type RegisterInput = { email: string; username: string; displayName: string; password: string };

export function register(input: RegisterInput): Promise<User> {
  return delay(() => {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) throw new ApiError('Ese correo ya tiene una cuenta.');
    if (db.users.some((u) => u.username === username)) throw new ApiError('Ese nombre de usuario ya está en uso.');
    const user = { id: newId(), email, username, displayName: input.displayName.trim(), password: input.password };
    db.users.push(user);
    return publicUser(user);
  });
}

export function login(identifier: string, password: string): Promise<User> {
  return delay(() => {
    const id = identifier.trim().toLowerCase();
    const user = db.users.find((u) => u.email === id || u.username === id);
    if (!user || user.password !== password) throw new ApiError('Correo o contraseña incorrectos.');
    return publicUser(user);
  });
}

// ---------- Hogares ----------

export function listMyHouseholds(userId: number): Promise<MyHousehold[]> {
  return delay(() =>
    db.memberships
      .filter((m) => m.userId === userId)
      .map((m) => {
        const h = db.households.find((x) => x.id === m.householdId)!;
        return { ...h, role: m.role, memberCount: db.memberships.filter((x) => x.householdId === h.id).length };
      }),
  );
}

export function createHousehold(userId: number, name: string): Promise<MyHousehold> {
  return delay(() => {
    const h = { id: newId(), name: name.trim(), inviteCode: newInviteCode(), currency: 'CLP' as const };
    db.households.push(h);
    db.memberships.push({ householdId: h.id, userId, role: 'admin' });
    db.categories.push(...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, id: newId(), householdId: h.id })));
    return { ...h, role: 'admin', memberCount: 1 };
  });
}

export function joinHousehold(userId: number, rawCode: string): Promise<MyHousehold> {
  return delay(() => {
    const code = normalizeInviteCode(rawCode);
    const h = db.households.find((x) => x.inviteCode === code);
    if (!h) throw new ApiError('No encontramos un hogar con ese código. Revisa que esté bien escrito.');
    if (db.memberships.some((m) => m.householdId === h.id && m.userId === userId)) {
      throw new ApiError(`Ya eres parte de ${h.name}.`);
    }
    db.memberships.push({ householdId: h.id, userId, role: 'member' });
    return { ...h, role: 'member', memberCount: db.memberships.filter((x) => x.householdId === h.id).length };
  });
}

export function listMembers(householdId: number): Promise<Member[]> {
  return delay(() =>
    db.memberships
      .filter((m) => m.householdId === householdId)
      .map((m) => ({ ...publicUser(db.users.find((u) => u.id === m.userId)!), role: m.role })),
  );
}

export function regenerateInviteCode(householdId: number, userId: number): Promise<string> {
  return delay(() => {
    if (requireMember(householdId, userId).role !== 'admin') throw new ApiError('Solo un administrador puede cambiar el código.');
    const h = db.households.find((x) => x.id === householdId)!;
    h.inviteCode = newInviteCode();
    return h.inviteCode;
  });
}

// ---------- Cuentas ----------

function toClp(o: { currency: 'CLP' | 'UF'; amount: number }) {
  return o.currency === 'UF' ? Math.round(o.amount * UF_VALUE) : o.amount;
}

function obligationViews(householdId: number): ObligationView[] {
  return db.obligations
    .filter((o) => o.householdId === householdId)
    .map((o) => {
      const daysLeft = daysUntil(o.nextDueOn);
      const status = daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'due_soon' : 'ok';
      return { ...o, daysLeft, status, amountClp: toClp(o) } as ObligationView;
    })
    .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn));
}

function visibleIncomes(householdId: number, userId: number) {
  return db.incomes.filter((i) => i.householdId === householdId && (!i.isPrivate || i.userId === userId));
}

export function getUfValue(): Promise<number> {
  return delay(() => UF_VALUE);
}

export function getMonthSummary(householdId: number, userId: number): Promise<MonthSummary> {
  return delay(() => {
    requireMember(householdId, userId);
    const t = today();
    const income = visibleIncomes(householdId, userId)
      .filter((i) => isSameMonth(i.receivedOn, t))
      .reduce((s, i) => s + i.amount, 0);
    const expenses = db.expenses
      .filter((e) => e.householdId === householdId && isSameMonth(e.spentOn, t))
      .reduce((s, e) => s + e.amount, 0);
    const ids = new Set(db.obligations.filter((o) => o.householdId === householdId).map((o) => o.id));
    const fixedPaid = db.obligationPayments
      .filter((p) => ids.has(p.obligationId) && isSameMonth(p.paidOn, t))
      .reduce((s, p) => s + p.amountClp, 0);
    const fixedPending = obligationViews(householdId)
      .filter((o) => o.everyMonths === 1 && (isSameMonth(o.nextDueOn, t) || o.status === 'overdue'))
      .reduce((s, o) => s + o.amountClp, 0);
    return { income, expenses, fixedPaid, fixedPending, balance: income - expenses - fixedPaid };
  });
}

export function listObligations(householdId: number): Promise<ObligationView[]> {
  return delay(() => obligationViews(householdId));
}

export function payObligation(obligationId: number, userId: number): Promise<void> {
  return delay(() => {
    const o = db.obligations.find((x) => x.id === obligationId);
    if (!o) throw new ApiError('No encontramos esa cuenta.');
    requireMember(o.householdId, userId);
    const paidOn = today();
    db.obligationPayments.push({
      id: newId(),
      obligationId,
      userId,
      amountClp: toClp(o),
      ufValue: o.currency === 'UF' ? UF_VALUE : undefined,
      paidOn,
    });
    o.lastPaidOn = paidOn;
    o.nextDueOn = addMonths(o.nextDueOn, o.everyMonths);
    if (o.installmentsTotal) o.installmentsPaid = Math.min(o.installmentsTotal, (o.installmentsPaid ?? 0) + 1);
  });
}

export function listMovements(householdId: number, userId: number): Promise<Movement[]> {
  return delay(() => {
    const userName = (id: number) => db.users.find((u) => u.id === id)?.displayName.split(' ')[0] ?? '';
    const category = (id: number) => db.categories.find((c) => c.id === id)?.name ?? 'Otros';
    const incomes: Movement[] = visibleIncomes(householdId, userId).map((i) => ({
      key: `i${i.id}`,
      kind: 'income',
      title: db.incomeSources.find((s) => s.id === i.sourceId)?.name ?? 'Ingreso',
      subtitle: `${formatShortDate(i.receivedOn)} · ${i.isPrivate ? 'Privado' : 'Compartido'}`,
      amount: i.amount,
      date: i.receivedOn,
    }));
    const expenses: Movement[] = db.expenses
      .filter((e) => e.householdId === householdId)
      .map((e) => ({
        key: `e${e.id}`,
        kind: 'expense',
        title: e.description || category(e.categoryId),
        subtitle: `${formatShortDate(e.spentOn)} · ${category(e.categoryId)} · ${userName(e.userId)}`,
        amount: e.amount,
        date: e.spentOn,
      }));
    const payments: Movement[] = db.obligationPayments
      .map((p) => ({ p, o: db.obligations.find((o) => o.id === p.obligationId)! }))
      .filter(({ o }) => o.householdId === householdId)
      .map(({ p, o }) => ({
        key: `p${p.id}`,
        kind: 'payment',
        title: o.name,
        subtitle: `${formatShortDate(p.paidOn)} · Pago de cuenta · ${userName(p.userId)}`,
        amount: p.amountClp,
        date: p.paidOn,
      }));
    return [...incomes, ...expenses, ...payments].sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  });
}

export function listIncomeSources(householdId: number, userId: number): Promise<IncomeSource[]> {
  return delay(() => db.incomeSources.filter((s) => s.householdId === householdId && (!s.isPrivate || s.userId === userId)));
}

export function listExpenseCategories(householdId: number): Promise<Category[]> {
  return delay(() => db.categories.filter((c) => c.householdId === householdId && c.kind === 'expense'));
}

export type ExpenseInput = { amount: number; categoryId: number; description: string };

export function addExpense(householdId: number, userId: number, input: ExpenseInput): Promise<Expense> {
  return delay(() => {
    requireMember(householdId, userId);
    if (!(input.amount > 0)) throw new ApiError('El monto debe ser mayor a cero.');
    const e = { id: newId(), householdId, userId, spentOn: today(), ...input, description: input.description.trim() };
    db.expenses.push(e);
    return e;
  });
}

// ---------- Tareas ----------

function periodStart(f: Frequency) {
  return f === 'daily' ? today() : weekStart(today());
}

export type RoutineWithCheck = Routine & { doneBy?: number };

export function listRoutines(householdId: number): Promise<RoutineWithCheck[]> {
  return delay(() =>
    db.routines
      .filter((r) => r.householdId === householdId)
      .map((r) => ({
        ...r,
        doneBy: db.routineChecks.find((c) => c.routineId === r.id && c.periodStart === periodStart(r.frequency))?.userId,
      })),
  );
}

export function toggleRoutine(routineId: number, userId: number): Promise<void> {
  return delay(() => {
    const r = db.routines.find((x) => x.id === routineId);
    if (!r) throw new ApiError('No encontramos esa rutina.');
    requireMember(r.householdId, userId);
    const p = periodStart(r.frequency);
    const idx = db.routineChecks.findIndex((c) => c.routineId === routineId && c.periodStart === p);
    if (idx >= 0) db.routineChecks.splice(idx, 1);
    else db.routineChecks.push({ routineId, userId, periodStart: p });
  });
}

export function listBacklog(householdId: number, userId: number): Promise<BacklogTaskView[]> {
  return delay(() => {
    const members = db.memberships.filter((m) => m.householdId === householdId).length;
    return db.backlog
      .filter((b) => b.householdId === householdId)
      .map((b) => {
        const votes = db.taskVotes.filter((v) => v.taskId === b.id);
        return { ...b, votes, myVote: votes.find((v) => v.userId === userId)?.points, pendingVoters: members - votes.length };
      });
  });
}

export const FIBONACCI = [1, 2, 3, 5, 8, 13] as const;

/**
 * Planning poker: cada miembro vota. Cuando votaron todos, queda el voto más alto.
 * En la simulación se cierra con mayoría simple, porque los demás miembros no pueden votar.
 */
export function voteTask(taskId: number, userId: number, points: number): Promise<void> {
  return delay(() => {
    const b = db.backlog.find((x) => x.id === taskId);
    if (!b || b.status !== 'estimating') throw new ApiError('Esta tarea ya no está en votación.');
    requireMember(b.householdId, userId);
    const existing = db.taskVotes.find((v) => v.taskId === taskId && v.userId === userId);
    if (existing) existing.points = points;
    else db.taskVotes.push({ taskId, userId, points });
    const votes = db.taskVotes.filter((v) => v.taskId === taskId);
    const members = db.memberships.filter((m) => m.householdId === b.householdId).length;
    if (votes.length >= Math.ceil(members / 2) + 1 || votes.length >= members) {
      b.points = Math.max(...votes.map((v) => v.points));
      b.status = 'open';
    }
  });
}

export function addBacklogTask(householdId: number, userId: number, title: string): Promise<void> {
  return delay(() => {
    requireMember(householdId, userId);
    db.backlog.push({ id: newId(), householdId, title: title.trim(), status: 'estimating' });
  });
}

export function takeTask(taskId: number, userId: number): Promise<void> {
  return delay(() => {
    const b = db.backlog.find((x) => x.id === taskId);
    if (!b || b.status !== 'open') throw new ApiError('Alguien ya tomó esta tarea.');
    b.status = 'taken';
    b.takenBy = userId;
  });
}

export function completeTask(taskId: number, userId: number): Promise<void> {
  return delay(() => {
    const b = db.backlog.find((x) => x.id === taskId);
    if (!b || b.takenBy !== userId) throw new ApiError('Solo quien tomó la tarea puede cerrarla.');
    b.status = 'done';
    b.doneOn = today();
  });
}

/** Puntos de la semana: rutinas marcadas + tareas del backlog terminadas. */
export function getRanking(householdId: number): Promise<RankingRow[]> {
  return delay(() => {
    const ws = weekStart(today());
    const routines = new Map(db.routines.filter((r) => r.householdId === householdId).map((r) => [r.id, r]));
    const rows = db.memberships
      .filter((m) => m.householdId === householdId)
      .map((m) => {
        const u = db.users.find((x) => x.id === m.userId)!;
        const routinePts = db.routineChecks
          .filter((c) => c.userId === u.id && c.periodStart >= ws && routines.has(c.routineId))
          .reduce((s, c) => s + routines.get(c.routineId)!.points, 0);
        const backlogPts = db.backlog
          .filter((b) => b.householdId === householdId && b.status === 'done' && b.takenBy === u.id && (b.doneOn ?? '') >= ws)
          .reduce((s, b) => s + (b.points ?? 0), 0);
        return { user: { ...publicUser(u), role: m.role }, points: routinePts + backlogPts };
      });
    return rows.sort((a, b) => b.points - a.points);
  });
}
