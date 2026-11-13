import { useNavigation } from '@react-navigation/native';
import { Fab } from '../components';

/** Botón global "+ Gasto": abre el registro rápido de gasto desde cualquier pestaña. */
export function ExpenseFab() {
  const navigation = useNavigation();
  return <Fab label="Gasto" accessibilityLabel="Agregar gasto" onPress={() => navigation.navigate('AddExpense')} />;
}
