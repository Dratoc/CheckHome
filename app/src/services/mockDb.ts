import { addDays, addMonths, today, weekStart } from '../utils/dates';
import type {
  BacklogTask,
  Category,
  Expense,
  Household,
  Income,
  IncomeSource,
  MemberRole,
  Obligation,
  ObligationPayment,
  Routine,
  RoutineCheck,
  TaskVote,
  User,
} from './types';

/**
 * Base de datos simulada en memoria. Se reinicia cada vez que se abre la app.
 * Reemplaza a Azure SQL mientras no exista la API (ver docs/adr/0001-api-en-app-service-f1.md).
 *
 * Usuario de prueba: demo@checkhome.cl / checkhome
 */

type UserRow = User & { password: string };
type MembershipRow = { householdId: number; userId: number; role: MemberRole };

const t = today();
const monthStart = t.slice(0, 8) + '01';
const thisMonth = (day: number) => t.slice(0, 8) + String(day).padStart(2, '0');

/** Valor UF simulado. La API lo tomará de mindicador.cl (ADR 0002). */
export const UF_VALUE = 39_820.45;

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id' | 'householdId'>[] = [
  { kind: 'expense', name: 'Supermercado', icon: 'cart-outline' },
  { kind: 'expense', name: 'Comida fuera', icon: 'restaurant-outline' },
  { kind: 'expense', name: 'Transporte', icon: 'car-outline' },
  { kind: 'expense', name: 'Casa', icon: 'home-outline' },
  { kind: 'expense', name: 'Salud', icon: 'medkit-outline' },
  { kind: 'expense', name: 'Otros', icon: 'ellipsis-horizontal' },
];

function seedCategories(householdId: number, startId: number): Category[] {
  return DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ ...c, id: startId + i, householdId }));
}

export const db = {
  users: [
    { id: 1, email: 'demo@checkhome.cl', username: 'hernan', displayName: 'Hernán Muñoz', password: 'checkhome' },
    { id: 2, email: 'paula@checkhome.cl', username: 'paula', displayName: 'Paula Soto', password: 'checkhome' },
    { id: 3, email: 'tomas@checkhome.cl', username: 'tomas', displayName: 'Tomás Muñoz', password: 'checkhome' },
    { id: 4, email: 'sofia@checkhome.cl', username: 'sofia', displayName: 'Sofía Muñoz', password: 'checkhome' },
    { id: 5, email: 'carla@checkhome.cl', username: 'carla', displayName: 'Carla Pérez', password: 'checkhome' },
  ] as UserRow[],

  households: [
    { id: 1, name: 'Casa Muñoz', inviteCode: 'K7M2QX9P', currency: 'CLP' },
    { id: 2, name: 'Depto Viña', inviteCode: 'VN4H8TRA', currency: 'CLP' },
  ] as Household[],

  memberships: [
    { householdId: 1, userId: 1, role: 'admin' },
    { householdId: 1, userId: 2, role: 'admin' },
    { householdId: 1, userId: 3, role: 'member' },
    { householdId: 1, userId: 4, role: 'member' },
    { householdId: 2, userId: 1, role: 'admin' },
    { householdId: 2, userId: 5, role: 'member' },
  ] as MembershipRow[],

  categories: [...seedCategories(1, 1), ...seedCategories(2, 101)] as Category[],

  incomeSources: [
    { id: 1, householdId: 1, userId: 1, name: 'Sueldo Hernán', payDay: 1, expectedAmount: 1_850_000, isPrivate: false },
    { id: 2, householdId: 1, userId: 2, name: 'Sueldo Paula', payDay: 5, expectedAmount: 1_620_000, isPrivate: true },
    { id: 3, householdId: 1, userId: 1, name: 'Arriendo depto Viña', payDay: 10, expectedAmount: 480_000, isPrivate: false },
  ] as IncomeSource[],

  incomes: [
    { id: 1, sourceId: 1, householdId: 1, userId: 1, amount: 1_850_000, receivedOn: thisMonth(1), isPrivate: false },
    { id: 2, sourceId: 2, householdId: 1, userId: 2, amount: 1_620_000, receivedOn: thisMonth(5), isPrivate: true },
    { id: 3, sourceId: 3, householdId: 1, userId: 1, amount: 480_000, receivedOn: thisMonth(10), isPrivate: false },
  ] as Income[],

  expenses: [
    { id: 1, householdId: 1, userId: 2, categoryId: 1, amount: 86_450, description: 'Compra semanal', spentOn: addDays(t, -1) },
    { id: 2, householdId: 1, userId: 1, categoryId: 3, amount: 25_000, description: 'Bencina', spentOn: addDays(t, -2) },
    { id: 3, householdId: 1, userId: 3, categoryId: 2, amount: 14_900, description: 'Completos', spentOn: addDays(t, -3) },
    { id: 4, householdId: 1, userId: 1, categoryId: 4, amount: 32_990, description: 'Ampolletas y pilas', spentOn: addDays(t, -6) },
    { id: 5, householdId: 1, userId: 2, categoryId: 5, amount: 18_400, description: 'Farmacia', spentOn: monthStart },
  ] as Expense[],

  obligations: [
    { id: 1, householdId: 1, kind: 'utility', name: 'Luz', currency: 'CLP', amount: 42_300, nextDueOn: addDays(t, -2), everyMonths: 1, accountNumber: '1234567-8' },
    { id: 2, householdId: 1, kind: 'utility', name: 'Agua', currency: 'CLP', amount: 18_700, nextDueOn: addDays(t, 3), everyMonths: 1, accountNumber: '998877' },
    { id: 3, householdId: 1, kind: 'subscription', name: 'Internet y TV', currency: 'CLP', amount: 34_990, nextDueOn: addDays(t, 6), everyMonths: 1 },
    { id: 4, householdId: 1, kind: 'mortgage', name: 'Dividendo casa', currency: 'UF', amount: 18.5, nextDueOn: addDays(t, 12), everyMonths: 1, lastPaidOn: addMonths(addDays(t, 12), -1) },
    { id: 5, householdId: 1, kind: 'loan', name: 'Crédito auto', currency: 'CLP', amount: 189_000, nextDueOn: addDays(t, 20), everyMonths: 1, installmentsTotal: 36, installmentsPaid: 14 },
    { id: 6, householdId: 1, kind: 'vehicle_doc', name: 'Permiso de circulación', currency: 'CLP', amount: 156_000, nextDueOn: addDays(t, 45), everyMonths: 12 },
    { id: 7, householdId: 1, kind: 'subscription', name: 'Streaming', currency: 'CLP', amount: 9_990, nextDueOn: addMonths(thisMonth(2), 1), everyMonths: 1, lastPaidOn: thisMonth(2) },
  ] as Obligation[],

  obligationPayments: [
    { id: 1, obligationId: 7, userId: 1, amountClp: 9_990, paidOn: thisMonth(2) },
  ] as ObligationPayment[],

  routines: [
    { id: 1, householdId: 1, name: 'Lavar la loza', frequency: 'daily', points: 2 },
    { id: 2, householdId: 1, name: 'Sacar la basura', frequency: 'daily', points: 1 },
    { id: 3, householdId: 1, name: 'Hacer las camas', frequency: 'daily', points: 1 },
    { id: 4, householdId: 1, name: 'Dar comida al perro', frequency: 'daily', points: 1 },
    { id: 5, householdId: 1, name: 'Regar las plantas', frequency: 'weekly', points: 2 },
    { id: 6, householdId: 1, name: 'Aspirar el living', frequency: 'weekly', points: 3 },
    { id: 7, householdId: 1, name: 'Cambiar sábanas', frequency: 'weekly', points: 3 },
  ] as Routine[],

  routineChecks: [
    { routineId: 1, userId: 2, periodStart: t },
    { routineId: 4, userId: 4, periodStart: t },
    { routineId: 6, userId: 3, periodStart: weekStart(t) },
    { routineId: 1, userId: 3, periodStart: addDays(t, -1) },
    { routineId: 2, userId: 1, periodStart: addDays(t, -1) },
  ] as RoutineCheck[],

  backlog: [
    { id: 1, householdId: 1, title: 'Arreglar la llave del baño', status: 'taken', points: 5, takenBy: 3 },
    { id: 2, householdId: 1, title: 'Ordenar la bodega', status: 'estimating' },
    { id: 3, householdId: 1, title: 'Pintar la reja', status: 'open', points: 13 },
    { id: 4, householdId: 1, title: 'Limpiar las canaletas', status: 'done', points: 8, takenBy: 4, doneOn: addDays(t, -2) },
  ] as BacklogTask[],

  taskVotes: [
    { taskId: 2, userId: 2, points: 8 },
    { taskId: 2, userId: 3, points: 5 },
  ] as TaskVote[],
};

let nextId = 1000;
export function newId() {
  return nextId++;
}

export { seedCategories };
