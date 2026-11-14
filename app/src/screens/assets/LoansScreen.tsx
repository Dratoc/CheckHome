import { View } from 'react-native';
import { Amount, Badge, Button, Card, EmptyState, IconCircle, ListItem, ProgressBar, QueryView, Screen, Text } from '../../components';
import { useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { ObligationView } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { addMonths, formatShortDate } from '../../utils/dates';
import { obligationBadge } from '../tabs/obligationUi';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** Créditos: cuántas cuotas van, cuánto falta y cuándo se termina de pagar. */
export function LoansScreen({ navigation }: RootScreenProps<'Loans'>) {
  const { household } = useHousehold();
  const query = useQuery(() => api.listObligations(household.id), [household.id]);
  const add = () => navigation.navigate('AddObligation', { kind: 'loan' });

  return (
    <Screen edges={['bottom']}>
      <QueryView
        query={query}
        isEmpty={(d) => !d.some((o) => o.kind === 'loan')}
        empty={
          <Card>
            <EmptyState title="Sin créditos" message="Anota cada crédito con su total de cuotas para ver cuánto falta." action="Agregar crédito" onAction={add} />
          </Card>
        }
      >
        {(rows) => {
          const loans = rows.filter((o) => o.kind === 'loan');
          const pending = loans.reduce((sum, o) => sum + remaining(o) * o.amountClp, 0);
          return (
            <>
              <Card tone="tinted">
                <Text variant="label" color="textMuted">
                  Deuda por pagar en cuotas
                </Text>
                <Amount value={pending} size="display" />
                <Text variant="caption" color="textMuted">
                  Cuotas que faltan por su valor actual (los créditos en UF, con la UF de hoy). Los créditos sin total de cuotas no suman.
                </Text>
              </Card>
              {loans.map((o) => (
                <LoanCard key={o.id} o={o} onOpen={() => navigation.navigate('ObligationDetail', { obligationId: o.id, name: o.name })} />
              ))}
              <Button label="Agregar crédito" variant="secondary" block onPress={add} />
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

/** Cuotas que faltan; 0 si el crédito no tiene total de cuotas. */
function remaining(o: ObligationView) {
  return o.installmentsTotal ? Math.max(0, o.installmentsTotal - (o.installmentsPaid ?? 0)) : 0;
}

function LoanCard({ o, onOpen }: { o: ObligationView; onOpen: () => void }) {
  const b = obligationBadge(o);
  const left = remaining(o);
  // La última cuota vence (left - 1) períodos después del próximo vencimiento.
  const lastDue = left > 0 ? addMonths(o.nextDueOn, (left - 1) * o.everyMonths) : undefined;
  return (
    <Card padding="md" onPress={onOpen} accessibilityLabel={`${o.name}: ver detalle e historial de pagos`}>
      <ListItem
        title={o.name}
        subtitle={`Próxima cuota ${formatShortDate(o.nextDueOn)}${o.currency === 'UF' ? ` · UF ${o.amount.toLocaleString('es-CL')}` : ''}`}
        leading={<IconCircle name="card-outline" tone={o.status === 'overdue' ? 'danger' : 'primary'} />}
        trailing={<Amount value={o.amountClp} />}
      />
      {o.installmentsTotal ? (
        <>
          <ProgressBar value={(o.installmentsPaid ?? 0) / o.installmentsTotal} accessibilityLabel={`${o.installmentsPaid ?? 0} de ${o.installmentsTotal} cuotas pagadas`} />
          <Text variant="caption" color="textMuted">
            {o.installmentsPaid ?? 0} de {o.installmentsTotal} cuotas pagadas
            {left > 0 && lastDue ? ` · faltan ${left}, termina en ${monthYear(lastDue)}` : ' · ¡pagado!'}
          </Text>
          {left > 0 && (
            <Text variant="caption" color="textMuted">
              Falta por pagar: <Amount value={left * o.amountClp} variant="caption" />
            </Text>
          )}
        </>
      ) : (
        <Text variant="caption" color="textMuted">
          Edítalo y agrega el total de cuotas para ver cuánto falta.
        </Text>
      )}
      <View style={{ alignItems: 'flex-start' }}>
        <Badge label={b.label} tone={b.tone} dot />
      </View>
    </Card>
  );
}
