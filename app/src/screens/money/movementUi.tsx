import { useNavigation } from '@react-navigation/native';
import { Amount, IconCircle, ListItem } from '../../components';
import type { Movement } from '../../services/types';

/** Tocar un movimiento abre lo que lo originó: el gasto, el ingreso o la cuenta pagada. */
export function useOpenMovement() {
  const navigation = useNavigation();
  return (m: Movement) => {
    if (m.kind === 'expense') navigation.navigate('AddExpense', { expenseId: m.id });
    else if (m.kind === 'income') navigation.navigate('EditIncome', { incomeId: m.id });
    else if (m.obligationId) navigation.navigate('ObligationDetail', { obligationId: m.obligationId, name: m.title });
  };
}

/** Una fila de movimiento: flecha de entrada o salida, qué fue y el monto. */
export function MovementRow({ m, onPress, divider }: { m: Movement; onPress: () => void; divider?: boolean }) {
  return (
    <ListItem
      title={m.title}
      subtitle={m.subtitle}
      leading={
        <IconCircle name={m.kind === 'income' ? 'arrow-down' : m.kind === 'payment' ? 'receipt-outline' : 'arrow-up'} tone={m.kind === 'income' ? 'primary' : 'neutral'} />
      }
      trailing={<Amount value={m.amount} sign={m.kind === 'income' ? 'income' : 'expense'} />}
      onPress={onPress}
      divider={divider}
    />
  );
}
