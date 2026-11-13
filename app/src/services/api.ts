import type {
  BacklogTaskView,
  Category,
  Expense,
  ExpenseView,
  Frequency,
  IncomeSource,
  IncomeView,
  Member,
  MonthSummary,
  Movement,
  MyHousehold,
  ObligationKind,
  ObligationPayment,
  ObligationView,
  RankingRow,
  Routine,
  User,
} from './types';

/**
 * Cliente de la API de CheckHome (carpeta api/, en las Functions de Azure Static Web Apps). La URL se fija al compilar con
 * EXPO_PUBLIC_API_URL. El usuario sale del JWT, así que los parámetros userId se mantienen solo para que
 * las pantallas no cambien; el servidor no confía en ellos.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(t: string | null) {
  token = t;
}

/** La sesión registra aquí qué hacer si el servidor responde 401 (token vencido). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// App Service F1 se duerme sin uso: la primera llamada puede tardar ~20 s en despertar.
const TIMEOUT_MS = 45_000;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new ApiError('La app no tiene configurada la dirección del servidor.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // Ambos encabezados: Static Web Apps podría reemplazar Authorization antes de llegar a la API.
        ...(token ? { Authorization: `Bearer ${token}`, 'X-CheckHome-Token': token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && token) onUnauthorized?.();
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | undefined)?.error ?? 'Algo falló en el servidor. Intenta de nuevo.';
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T = void>(path: string, body: unknown = {}) => request<T>('POST', path, body);
const patch = <T = void>(path: string, body: unknown) => request<T>('PATCH', path, body);
/** Borra y resuelve true, para que useMutation distinga éxito (true) de error (undefined). */
const del = (path: string) => request<void>('DELETE', path).then(() => true as const);

/** Normaliza lo que escribe la persona: sin espacios ni guiones, en mayúscula. */
export function normalizeInviteCode(raw: string) {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

// ---------- Acceso ----------

export type AuthResult = { token: string; user: User };

export type RegisterInput = { email: string; username: string; displayName: string; password: string };

export function register(input: RegisterInput): Promise<AuthResult> {
  return post('/auth/register', input);
}

export function login(identifier: string, password: string): Promise<AuthResult> {
  return post('/auth/login', { identifier, password });
}

// ---------- Hogares ----------

export function listMyHouseholds(_userId?: number): Promise<MyHousehold[]> {
  return get('/households');
}

export function createHousehold(_userId: number, name: string): Promise<MyHousehold> {
  return post('/households', { name });
}

export function joinHousehold(_userId: number, rawCode: string): Promise<MyHousehold> {
  return post('/households/join', { code: normalizeInviteCode(rawCode) });
}

export function listMembers(householdId: number): Promise<Member[]> {
  return get(`/households/${householdId}/members`);
}

export async function regenerateInviteCode(householdId: number, _userId?: number): Promise<string> {
  return (await post<{ inviteCode: string }>(`/households/${householdId}/invite-code`)).inviteCode;
}

// ---------- Cuentas ----------

export async function getUfValue(): Promise<number> {
  return (await get<{ value: number }>('/uf')).value;
}

export function getMonthSummary(householdId: number, _userId?: number): Promise<MonthSummary> {
  return get(`/households/${householdId}/summary`);
}

export function listObligations(householdId: number): Promise<ObligationView[]> {
  return get(`/households/${householdId}/obligations`);
}

export type ObligationInput = {
  kind: ObligationKind;
  name: string;
  currency: 'CLP' | 'UF';
  amount: number;
  nextDueOn: string;
  everyMonths: number;
  accountNumber?: string;
  installmentsTotal?: number;
  installmentsPaid?: number;
};

export function createObligation(householdId: number, input: ObligationInput): Promise<ObligationView> {
  return post(`/households/${householdId}/obligations`, input);
}

export function getObligation(obligationId: number): Promise<ObligationView> {
  return get(`/obligations/${obligationId}`);
}

export function updateObligation(obligationId: number, input: ObligationInput): Promise<ObligationView> {
  return patch(`/obligations/${obligationId}`, input);
}

/** Borra la cuenta y todo su historial de pagos. */
export function deleteObligation(obligationId: number) {
  return del(`/obligations/${obligationId}`);
}

export function listObligationPayments(obligationId: number): Promise<ObligationPayment[]> {
  return get(`/obligations/${obligationId}/payments`);
}

/** Deshace el último "Marcar pagado": el vencimiento vuelve un período atrás. */
export function undoObligationPayment(paymentId: number) {
  return del(`/obligation-payments/${paymentId}`);
}

export function payObligation(obligationId: number, _userId?: number): Promise<void> {
  return post(`/obligations/${obligationId}/pay`);
}

export function listMovements(householdId: number, _userId?: number): Promise<Movement[]> {
  return get(`/households/${householdId}/movements`);
}

export function listIncomeSources(householdId: number, _userId?: number): Promise<IncomeSource[]> {
  return get(`/households/${householdId}/income-sources`);
}

export type IncomeSourceInput = { name: string; payDay: number; expectedAmount: number; isPrivate: boolean };

export function createIncomeSource(householdId: number, input: IncomeSourceInput): Promise<IncomeSource> {
  return post(`/households/${householdId}/income-sources`, input);
}

/** Anota un pago recibido de una fuente (por defecto, con fecha de hoy). */
export function addIncome(sourceId: number, amount: number, receivedOn?: string): Promise<void> {
  return post(`/income-sources/${sourceId}/incomes`, { amount, receivedOn });
}

export function updateIncomeSource(sourceId: number, input: IncomeSourceInput): Promise<IncomeSource> {
  return patch(`/income-sources/${sourceId}`, input);
}

/** Borra la fuente y todos los pagos anotados en ella. */
export function deleteIncomeSource(sourceId: number) {
  return del(`/income-sources/${sourceId}`);
}

export function getIncome(incomeId: number): Promise<IncomeView> {
  return get(`/incomes/${incomeId}`);
}

export function updateIncome(incomeId: number, amount: number, receivedOn: string): Promise<IncomeView> {
  return patch(`/incomes/${incomeId}`, { amount, receivedOn });
}

export function deleteIncome(incomeId: number) {
  return del(`/incomes/${incomeId}`);
}

export function listExpenseCategories(householdId: number): Promise<Category[]> {
  return get(`/households/${householdId}/categories?kind=expense`);
}

export type ExpenseInput = { amount: number; categoryId: number; description: string };

export function addExpense(householdId: number, _userId: number, input: ExpenseInput): Promise<Expense> {
  return post(`/households/${householdId}/expenses`, input);
}

export function getExpense(expenseId: number): Promise<ExpenseView> {
  return get(`/expenses/${expenseId}`);
}

export function updateExpense(expenseId: number, input: ExpenseInput & { spentOn: string }): Promise<ExpenseView> {
  return patch(`/expenses/${expenseId}`, input);
}

export function deleteExpense(expenseId: number) {
  return del(`/expenses/${expenseId}`);
}

// ---------- Tareas ----------

export type RoutineWithCheck = Routine & { doneBy?: number };

export function listRoutines(householdId: number): Promise<RoutineWithCheck[]> {
  return get(`/households/${householdId}/routines`);
}

export type RoutineInput = { name: string; frequency: Frequency; points: number };

export function createRoutine(householdId: number, input: RoutineInput): Promise<Routine> {
  return post(`/households/${householdId}/routines`, input);
}

export function updateRoutine(routineId: number, input: RoutineInput): Promise<Routine> {
  return patch(`/routines/${routineId}`, input);
}

export function deleteRoutine(routineId: number) {
  return del(`/routines/${routineId}`);
}

export function toggleRoutine(routineId: number, _userId?: number): Promise<void> {
  return post(`/routines/${routineId}/toggle`);
}

export function listBacklog(householdId: number, _userId?: number): Promise<BacklogTaskView[]> {
  return get(`/households/${householdId}/backlog`);
}

export const FIBONACCI = [1, 2, 3, 5, 8, 13] as const;

/** Planning poker: cada miembro vota y, cuando votaron todos, queda el voto más alto. */
export function voteTask(taskId: number, _userId: number, points: number): Promise<void> {
  return post(`/backlog/${taskId}/vote`, { points });
}

export function addBacklogTask(householdId: number, _userId: number, title: string): Promise<void> {
  return post(`/households/${householdId}/backlog`, { title });
}

export function takeTask(taskId: number, _userId?: number): Promise<void> {
  return post(`/backlog/${taskId}/take`);
}

export function completeTask(taskId: number, _userId?: number): Promise<void> {
  return post(`/backlog/${taskId}/complete`);
}

export function renameTask(taskId: number, title: string) {
  return patch(`/backlog/${taskId}`, { title }).then(() => true as const);
}

export function deleteTask(taskId: number) {
  return del(`/backlog/${taskId}`);
}

/** Puntos de la semana: rutinas marcadas + tareas del backlog terminadas. */
export function getRanking(householdId: number): Promise<RankingRow[]> {
  return get(`/households/${householdId}/ranking`);
}
