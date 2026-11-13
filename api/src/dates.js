/**
 * Fechas de calendario en hora de Chile. El servidor corre en UTC, pero "hoy" para el hogar es el día
 * en Santiago. Todas las fechas viajan como texto YYYY-MM-DD.
 */
const TZ = process.env.APP_TIMEZONE || 'America/Santiago';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export function today() {
  return fmt.format(new Date());
}

function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

/** DATE de SQL (llega como Date a medianoche UTC) a YYYY-MM-DD. */
export function fromSql(d) {
  return d ? iso(d) : undefined;
}

export function addMonths(isoDate, months) {
  const d = parse(isoDate);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
}

export function daysUntil(isoDate) {
  return Math.round((parse(isoDate) - parse(today())) / 86_400_000);
}

/** Lunes de la semana. */
export function weekStart(isoDate) {
  const d = parse(isoDate);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}

export function monthStart(isoDate) {
  return isoDate.slice(0, 8) + '01';
}

export function nextMonthStart(isoDate) {
  return addMonths(monthStart(isoDate), 1);
}

export function isIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime()) && iso(parse(s)) === s;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "15 nov" */
export function formatShortDate(isoDate) {
  const d = parse(isoDate);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
