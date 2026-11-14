import { useState } from 'react';
import { View } from 'react-native';
import { Amount, Badge, Button, Card, EmptyState, IconCircle, ListItem, QueryView, Screen, SectionHeader, Text } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { CardStatementDetail } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { confirmDanger } from '../../utils/confirm';
import { formatShortDate } from '../../utils/dates';

/**
 * Estado de cuenta de la tarjeta según la app: lo cargado entre un corte y el siguiente ("facturado según la app"),
 * para compararlo con el del banco. Si no calza, falta anotar algo. Aquí también se anota el pago de la tarjeta.
 */
export function CardStatementScreen({ navigation, route }: RootScreenProps<'CardStatement'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const { methodId } = route.params;
  const [end, setEnd] = useState(route.params.end);
  const query = useQuery(() => api.getCardStatement(methodId, end), [methodId, end]);
  const removePayment = useMutation(async (id: number) => {
    await api.deleteCardPayment(id);
    await query.reload();
  });
  const methods = useQuery(() => api.listPaymentMethods(household.id), [household.id]);

  const onRemove = async (id: number, amount: number) => {
    if (await confirmDanger('¿Borrar este pago de la tarjeta?', `Se borra el pago de ${amount.toLocaleString('es-CL')} pesos.`, 'Borrar')) await removePayment.run(id);
  };

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
            <Summary s={s} onPay={() => navigation.navigate('PayCard', { methodId, name: s.name, statementEnd: s.end, label: s.label, suggested: s.pending })} />
            {removePayment.error && <Text color="danger">{removePayment.error}</Text>}

            <SectionHeader title="Cargos anotados" />
            <Card padding="md">
              {s.charges.length === 0 ? (
                <EmptyState title="Sin cargos en este período" message="Los gastos y cuentas pagados con esta tarjeta aparecen aquí según su fecha." />
              ) : (
                s.charges.map((c, i) => (
                  <ListItem
                    key={c.key}
                    title={c.title}
                    subtitle={`${formatShortDate(c.date)} · ${c.subtitle}`}
                    leading={<IconCircle name={c.kind === 'payment' ? 'receipt-outline' : 'arrow-up'} tone="neutral" />}
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

            {s.payments.length > 0 && (
              <>
                <SectionHeader title="Pagos de este estado" />
                <Card padding="md">
                  {s.payments.map((p, i) => (
                    <ListItem
                      key={p.id}
                      title={`Pagó ${p.paidBy.split(' ')[0]}`}
                      subtitle={`${formatShortDate(p.paidOn)} · Toca para borrar`}
                      leading={<IconCircle name="checkmark" tone="primary" />}
                      trailing={<Amount value={p.amount} />}
                      onPress={() => onRemove(p.id, p.amount)}
                      divider={i < s.payments.length - 1}
                    />
                  ))}
                </Card>
              </>
            )}
            <Button
              label="Editar tarjeta"
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

function Summary({ s, onPay }: { s: CardStatementDetail; onPay: () => void }) {
  const t = useTheme();
  const status = !s.isClosed ? { label: 'Período abierto', tone: 'neutral' as const } : s.pending > 0 ? { label: `Vence el ${formatShortDate(s.dueOn)}`, tone: 'warning' as const } : { label: 'Pagado', tone: 'success' as const };
  return (
    <Card tone="tinted">
      <Text variant="label" color="textMuted">
        Facturado según la app
      </Text>
      <Amount value={s.charged} size="display" />
      <Text variant="caption" color="textMuted">
        Compáralo con el estado de cuenta del banco. Si no calza, falta anotar algún gasto o alguno quedó con otra fecha.
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="body">Pagado</Text>
        <Amount value={s.paid} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="body">Por pagar</Text>
        <Amount value={s.pending} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
        <Badge label={status.label} tone={status.tone} dot />
        <Button label="Pagar tarjeta" size="sm" variant="secondary" onPress={onPay} />
      </View>
    </Card>
  );
}
