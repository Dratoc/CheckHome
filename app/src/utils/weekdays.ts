/** Días de la semana de las rutinas: 1 = lunes … 7 = domingo (igual que la API). */
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const same = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

/** Cómo se repite una rutina, en palabras: "Todos los días", "Lunes a viernes", "Lun, Mié, Vie"… */
export function repeatLabel(r: { frequency: 'daily' | 'weekly'; days?: number[] }) {
  if (r.frequency === 'weekly') return 'Una vez por semana';
  const days = r.days ?? ALL_DAYS;
  if (same(days, ALL_DAYS)) return 'Todos los días';
  if (same(days, [1, 2, 3, 4, 5])) return 'Lunes a viernes';
  if (same(days, [6, 7])) return 'Fin de semana';
  if (days.length === 1) return `Los ${DAY_NAMES[days[0] - 1].toLowerCase()}${days[0] >= 6 ? 's' : ''}`;
  return days.map((d) => DAY_ABBR[d - 1]).join(', ');
}
