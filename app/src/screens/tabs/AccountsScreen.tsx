import { useState } from 'react';
import { View } from 'react-native';
import {
  Amount,
  Badge,
  Button,
  Card,
  EmptyState,
  IconCircle,
  ListItem,
  ProgressBar,
  QueryView,
  Screen,
  SegmentedControl,
  Text,
} from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import { ExpenseFab } from '../../navigation/ExpenseFab';
import type { TabScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { IncomeSource, Movement, ObligationView } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { obligationBadge, obligationIcon, obligationSubtitle } from './obligationUi';

type Section = 'movements' | 'obligations' | 'income';

/** Cuentas: movimientos del hogar, cuentas por pagar y fuentes de ingreso. */
export function AccountsScreen({ navigation }: TabScreenProps<'Accounts'>) {
  const t = useTheme();
  const [section, setSection] = useState<Section>('movements');

  // Tocar un movimiento abre lo que lo originó: el gasto, el ingreso o la cuenta pagada.
  const openMovement = (m: Movement) => {
    if (m.kind === 'expense') navigation.navigate('AddExpense', { expenseId: m.id });
    else if (m.kind === 'income') navigation.navigate('EditIncome', { incomeId: m.id });
    else if (m.obligationId) navigation.navigate('ObligationDetail', { obligationId: m.obligationId, name: m.title });
  };

  return (
    <Screen edges={['top']} overlay={<ExpenseFab />}>
      <Text variant="title" accessibilityRole="header">
        Cuentas
      </Text>
      <SegmentedControl<Section>
        value={section}
        onChange={setSection}
        options={[
          { value: 'movements', label: 'Movimientos' },
          { value: 'obligations', label: 'Por pagar' },
          { value: 'income', label: 'Ingresos' },
        ]}
      />
      {section === 'movements' && <Movements onAdd={() => navigation.navigate('AddExpense')} onOpen={openMovement} />}
      {section === 'obligations' && (
        <Obligations onAdd={() => navigation.navigate('AddObligation')} onOpen={(o) => navigation.navigate('ObligationDetail', { obligationId: o.id, name: o.name })} />
      )}
      {section === 'income' && (
        <IncomeSources onAdd={() => navigation.navigate('AddIncomeSource')} onReceive={(s) => navigation.navigate('AddIncome', { source: s })} />
      )}

      <Card padding="md" style={{ marginTop: t.spacing.sm }}>
        <Text variant="label">Próximamente</Text>
        <Text variant="caption" color="textMuted">
          Vehículos, propiedades y créditos en detalle llegan en la fase 4 del MVP.
        </Text>
      </Card>
    </Screen>
  );
}

function Movements({ onAdd, onOpen }: { onAdd: () => void; onOpen: (m: Movement) => void }) {
  const { user, household } = useHousehold();
  const query = useQuery(() => api.listMovements(household.id, user.id), [household.id, user.id]);
  return (
    <Card padding="md">
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="Sin movimientos todavía" message="Anota el primer gasto del hogar." action="Agregar gasto" onAction={onAdd} />}
      >
        {(rows) =>
          rows.map((m, i) => (
            <ListItem
              key={m.key}
              title={m.title}
              subtitle={m.subtitle}
              leading={
                <IconCircle
                  name={m.kind === 'income' ? 'arrow-down' : m.kind === 'payment' ? 'receipt-outline' : 'arrow-up'}
                  tone={m.kind === 'income' ? 'primary' : 'neutral'}
                />
              }
              trailing={<Amount value={m.amount} sign={m.kind === 'income' ? 'income' : 'expense'} />}
              onPress={() => onOpen(m)}
              divider={i < rows.length - 1}
            />
          ))
        }
      </QueryView>
    </Card>
  );
}

function Obligations({ onAdd, onOpen }: { onAdd: () => void; onOpen: (o: ObligationView) => void }) {
  const { user, household } = useHousehold();
  const query = useQuery(() => api.listObligations(household.id), [household.id]);
  const pay = useMutation(api.payObligation);
  const [payingId, setPayingId] = useState<number>();

  const onPay = async (o: ObligationView) => {
    setPayingId(o.id);
    await pay.run(o.id, user.id);
    setPayingId(undefined);
    query.reload();
  };

  return (
    <QueryView
      query={query}
      isEmpty={(d) => d.length === 0}
      empty={
        <Card>
          <EmptyState title="Sin cuentas registradas" message="Agrega luz, agua, dividendo, créditos y papeles del auto para no olvidar ningún vencimiento." action="Agregar cuenta" onAction={onAdd} />
        </Card>
      }
    >
      {(rows) => (
        <>
          {pay.error && <Text color="danger">{pay.error}</Text>}
          {rows.map((o) => (
            <ObligationCard key={o.id} o={o} paying={payingId === o.id} onPay={() => onPay(o)} onOpen={() => onOpen(o)} />
          ))}
          <Button label="Agregar cuenta" variant="secondary" block onPress={onAdd} />
        </>
      )}
    </QueryView>
  );
}

function ObligationCard({ o, paying, onPay, onOpen }: { o: ObligationView; paying: boolean; onPay: () => void; onOpen: () => void }) {
  const t = useTheme();
  const b = obligationBadge(o);
  return (
    <Card padding="md" onPress={onOpen} accessibilityLabel={`${o.name}: ver detalle e historial de pagos`}>
      <ListItem
        title={o.name}
        subtitle={obligationSubtitle(o)}
        leading={<IconCircle name={obligationIcon[o.kind]} tone={o.status === 'overdue' ? 'danger' : o.status === 'due_soon' ? 'warning' : 'primary'} />}
        trailing={<Amount value={o.amountClp} />}
      />
      {o.installmentsTotal ? (
        <ProgressBar value={(o.installmentsPaid ?? 0) / o.installmentsTotal} accessibilityLabel={`${o.installmentsPaid} de ${o.installmentsTotal} cuotas pagadas`} />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
        <Badge label={b.label} tone={b.tone} dot />
        {o.status !== 'ok' && <Button label="Marcar pagado" size="sm" variant="secondary" loading={paying} onPress={onPay} />}
      </View>
    </Card>
  );
}

function IncomeSources({ onAdd, onReceive }: { onAdd: () => void; onReceive: (s: IncomeSource) => void }) {
  const { user, household } = useHousehold();
  const query = useQuery(() => api.listIncomeSources(household.id, user.id), [household.id, user.id]);
  return (
    <Card padding="md">
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="Sin fuentes de ingreso" message="Define una vez tu sueldo o arriendo con su día de pago." action="Agregar fuente" onAction={onAdd} />}
      >
        {(rows) => (
          <>
            {rows.map((s) => (
              <ListItem
                key={s.id}
                title={s.name}
                subtitle={`Llega el día ${s.payDay} · ${s.isPrivate ? 'Privado' : 'Compartido'} · Toca para anotar un pago`}
                leading={<IconCircle name={s.isPrivate ? 'lock-closed-outline' : 'cash-outline'} tone="primary" />}
                trailing={<Amount value={s.expectedAmount} sign="income" />}
                onPress={() => onReceive(s)}
                divider
              />
            ))}
            <Button label="Agregar fuente" variant="ghost" block onPress={onAdd} />
          </>
        )}
      </QueryView>
    </Card>
  );
}
