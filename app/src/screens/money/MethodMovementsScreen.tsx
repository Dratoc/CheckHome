import { useState } from 'react';
import { View } from 'react-native';
import { Amount, Badge, Button, Card, EmptyState, IconCircle, ListItem, QueryView, Screen, SectionHeader, Text } from '../../components';
import { useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { formatShortDate } from '../../utils/dates';
import { methodIcon, methodKindLabel } from './paymentMethodUi';

/**
 * Gastos y cuentas pagados con un débito o con efectivo, por mes del hogar (el mismo ciclo del cierre del mes).
 * Abre en el mes en curso; desde aquí también se edita el medio de pago.
 */
export function MethodMovementsScreen({ navigation, route }: RootScreenProps<'MethodMovements'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const { methodId } = route.params;
  const [end, setEnd] = useState(route.params.end);
  const query = useQuery(() => api.getMethodMovements(methodId, end), [methodId, end]);
  const methods = useQuery(() => api.listPaymentMethods(household.id), [household.id]);

  return (
    <Screen edges={['bottom']}>
      <QueryView query={query}>
        {(s) => (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
              <Button label="‹ Anterior" size="sm" variant="ghost" onPress={() => setEnd(s.prevEnd)} />
              <Text variant="label">{s.label}</Text>
              <Button label="Siguiente ›" size="sm" variant="ghost" onPress={() => setEnd(s.nextEnd)} />
            </View>

            <Card tone="tinted">
              <Text variant="label" color="textMuted">
                Gastado con {methodKindLabel[s.kind].toLowerCase()}
              </Text>
              <Amount value={s.total} size="display" />
              {s.isCurrent && <Badge label="Mes en curso" tone="neutral" dot />}
            </Card>

            <SectionHeader title="Gastos anotados" />
            <Card padding="md">
              {s.charges.length === 0 ? (
                <EmptyState
                  title="Sin gastos en este mes"
                  message="Los gastos y cuentas anotados con este medio de pago aparecen aquí según su fecha. Si anotaste alguno y no está, revisa si quedó como «Sin indicar»."
                />
              ) : (
                s.charges.map((c, i) => (
                  <ListItem
                    key={c.key}
                    title={c.title}
                    subtitle={`${formatShortDate(c.date)} · ${c.subtitle}`}
                    leading={<IconCircle name={c.isRefund ? 'arrow-down' : c.kind === 'payment' ? 'receipt-outline' : methodIcon[s.kind]} tone={c.isRefund ? 'primary' : 'neutral'} />}
                    trailing={<Amount value={c.amount} />}
                    onPress={() =>
                      c.kind === 'expense'
                        ? navigation.navigate('AddExpense', { expenseId: c.id })
                        : c.obligationId && navigation.navigate('ObligationDetail', { obligationId: c.obligationId, name: c.title })
                    }
                    divider={i < s.charges.length - 1}
                  />
                ))
              )}
            </Card>

            <Button
              label="Editar medio de pago"
              variant="ghost"
              block
              onPress={() => {
                const m = methods.data?.find((x) => x.id === methodId);
                if (m) navigation.navigate('AddPaymentMethod', { method: m });
              }}
            />
          </>
        )}
      </QueryView>
    </Screen>
  );
}
