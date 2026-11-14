import { Button, Card, EmptyState, IconCircle, ListItem, QueryView, Screen, Text } from '../../components';
import { useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { methodIcon, methodSubtitle } from './paymentMethodUi';

/** Medios de pago del hogar: tarjeta de crédito (con corte y vencimiento), débito y efectivo. */
export function PaymentMethodsScreen({ navigation }: RootScreenProps<'PaymentMethods'>) {
  const { household } = useHousehold();
  const query = useQuery(() => api.listPaymentMethods(household.id), [household.id]);
  const add = () => navigation.navigate('AddPaymentMethod');

  return (
    <Screen edges={['bottom']}>
      <Text variant="caption" color="textMuted">
        Cada gasto se anota con el medio con que se pagó. Así la tarjeta cuadra con su estado de cuenta y el cierre del mes sabe de qué bolsillo salió la plata.
      </Text>
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyState title="Sin medios de pago" message="Agrega tu tarjeta de crédito con su día de corte y vencimiento, tus débitos y el efectivo." action="Agregar medio de pago" onAction={add} />
          </Card>
        }
      >
        {(rows) => (
          <>
            <Card padding="md">
              {rows.map((m, i) => (
                <ListItem
                  key={m.id}
                  title={m.name}
                  subtitle={m.kind === 'credit' ? `${methodSubtitle(m)} · Ver estado de cuenta` : methodSubtitle(m)}
                  leading={<IconCircle name={methodIcon[m.kind]} tone={m.kind === 'credit' ? 'primary' : 'neutral'} />}
                  onPress={() =>
                    m.kind === 'credit' ? navigation.navigate('CardStatement', { methodId: m.id, name: m.name }) : navigation.navigate('AddPaymentMethod', { method: m })
                  }
                  divider={i < rows.length - 1}
                />
              ))}
            </Card>
            <Button label="Agregar medio de pago" variant="secondary" block onPress={add} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}
