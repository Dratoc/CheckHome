/**
 * Ciclos del mes del hogar y de cada tarjeta. Un ciclo se identifica por su último día (el corte).
 * Con corte 19, el ciclo va del 20 de un mes al 19 del siguiente. Sin corte, es el mes calendario.
 * Fechas como texto YYYY-MM-DD, sin zona horaria.
 */
import { addMonths, formatShortDate } from './dates.js';

const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m de 1 a 12

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Día del corte en el mes de la fecha dada; si el mes es más corto (corte 31 en febrero), su último día. */
function cutInMonth(iso, cutDay) {
  const [y, m] = iso.split('-').map(Number);
  const day = Math.min(cutDay ?? 31, lastDayOf(y, m));
  return `${y}-${pad(m)}-${pad(day)}`;
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ciclo que contiene la fecha: { start, end }. cutDay null = mes calendario. */
export function cycleOf(iso, cutDay) {
  const thisCut = cutInMonth(iso, cutDay);
  const end = iso <= thisCut ? thisCut : cutInMonth(addMonths(iso.slice(0, 8) + '01', 1), cutDay);
  const prevEnd = cutInMonth(addMonths(end.slice(0, 8) + '01', -1), cutDay);
  return { start: addDays(prevEnd, 1), end };
}

export const previousCycle = (c, cutDay) => cycleOf(addDays(c.start, -1), cutDay);
export const nextCycle = (c, cutDay) => cycleOf(addDays(c.end, 1), cutDay);

/** "20 oct – 19 nov" */
export const cycleLabel = (c) => `${formatShortDate(c.start)} – ${formatShortDate(c.end)}`;

/**
 * Estado de cuenta que se paga en una fecha: el último corte que ya pasó.
 * Pagar el 5 de diciembre con corte 19 paga el estado del 20 oct al 19 nov.
 */
export function statementPaidOn(iso, cutDay) {
  const c = cycleOf(iso, cutDay);
  return c.end === iso ? c : previousCycle(c, cutDay);
}

/** Estado de una tarjeta que cae dentro del ciclo del hogar: el que termina entre su inicio y su fin. */
export function cardStatementIn(householdCycle, cutDay) {
  const c = cycleOf(householdCycle.end, cutDay);
  return c.end > householdCycle.end ? previousCycle(c, cutDay) : c;
}

/** Vencimiento del pago de un estado: el primer due_day después del corte. */
export function dueDateOf(statementEnd, dueDay) {
  const sameMonth = cutInMonth(statementEnd, dueDay);
  return sameMonth > statementEnd ? sameMonth : cutInMonth(addMonths(statementEnd.slice(0, 8) + '01', 1), dueDay);
}
