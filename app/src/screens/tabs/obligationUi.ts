import type { BadgeTone } from '../../components';
import type { IconName } from '../../components/IconCircle';
import type { ObligationKind, ObligationView } from '../../services/types';
import { formatShortDate, relativeDays } from '../../utils/dates';

export const obligationIcon: Record<ObligationKind, IconName> = {
  subscription: 'tv-outline',
  utility: 'flash-outline',
  mortgage: 'home-outline',
  loan: 'card-outline',
  vehicle_doc: 'car-sport-outline',
  other: 'document-text-outline',
};

export function obligationBadge(o: ObligationView): { label: string; tone: BadgeTone } {
  if (o.status === 'overdue') return { label: 'Atrasado', tone: 'danger' };
  if (o.status === 'due_soon') return { label: o.daysLeft === 0 ? 'Vence hoy' : `Vence en ${o.daysLeft} d`, tone: 'warning' };
  return { label: 'Al día', tone: 'success' };
}

export function obligationSubtitle(o: ObligationView) {
  const due = o.status === 'overdue' ? `Venció ${relativeDays(o.daysLeft).toLowerCase()}` : `Vence ${formatShortDate(o.nextDueOn)}`;
  const extra = o.installmentsTotal ? ` · Cuota ${(o.installmentsPaid ?? 0) + 1} de ${o.installmentsTotal}` : o.currency === 'UF' ? ` · UF ${o.amount.toFixed(2).replace('.', ',')}` : '';
  const owner = o.vehicleName ?? o.propertyName;
  return (owner ? `${owner} · ` : '') + due + extra;
}
