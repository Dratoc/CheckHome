import type { IconName } from '../../components';
import type { PaymentMethod, PaymentMethodKind } from '../../services/types';

export const methodIcon: Record<PaymentMethodKind, IconName> = {
  credit: 'card-outline',
  debit: 'wallet-outline',
  cash: 'cash-outline',
};

export const methodKindLabel: Record<PaymentMethodKind, string> = {
  credit: 'Tarjeta de crédito',
  debit: 'Débito',
  cash: 'Efectivo',
};

/** "Corte día 19 · vence el 5 · de Hernán" */
export function methodSubtitle(m: PaymentMethod) {
  const owner = m.ownerName ? `de ${m.ownerName.split(' ')[0]}` : '';
  if (m.kind === 'credit') return [`Corte día ${m.cutDay}`, `vence el ${m.dueDay}`, owner].filter(Boolean).join(' · ');
  return [methodKindLabel[m.kind], owner].filter(Boolean).join(' · ');
}

/** Opciones para los chips "Pagado con". */
export const methodChoices = (methods: PaymentMethod[]) => methods.map((m) => ({ value: m.id, label: m.name, icon: methodIcon[m.kind] }));
