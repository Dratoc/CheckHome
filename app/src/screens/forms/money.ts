import { formatCLP } from '../../components';

/** Solo dígitos → número de pesos. */
export const parseClp = (raw: string) => Number(raw.replace(/\D/g, '')) || 0;

/** Muestra "1.250.000" mientras se escribe. */
export const showClp = (n: number) => (n ? formatCLP(n).replace(/[^\d.]/g, '') : '');

/** "18,5" o "18.5" → 18.5 (montos en UF). */
export const parseDecimal = (raw: string) => {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
