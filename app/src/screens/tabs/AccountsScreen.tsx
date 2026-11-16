import { useState } from 'react';
import { View } from 'react-native';
import {
  Amount,
  Badge,
  Button,
  Card,
  EmptyState,
  Fab,
  IconCircle,
  ListItem,
  ProgressBar,
  QueryView,
  Screen,
  SectionHeader,
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
import { MovementRow, useOpenMovement } from '../money/movementUi';
import { obligationBadge, obligationIcon, obligationSubtitle } from './obligationUi';

type Section = 'movements' | 'obligations' | 'income';

/** Cuentas: los últimos movimientos del hogar (el historial completo, en Movimientos), cuentas por pagar y fuentes de ingreso. */
export function AccountsScreen({ navigation }: TabScreenProps<'Accounts'>) {
  const [section, setSection] = useState<Section>('movements');

  const openMovement = useOpenMovement();
  // El botón flotante sigue a la sección: gasto en Movimientos, cuenta en Por pagar. Ingresos ya tiene su botón.
  const fab =
    section === 'movements' ? <ExpenseFab /> : section === 'obligations' ? <Fab label="Cuenta" accessibilityLabel="Agregar cuenta por pagar" onPress={() => navigation.navigate('AddObligation')} /> : undefined;

  return (
    <Screen edges={['top']} overlay={fab}>
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
      {section === 'movements' && (
        <Movements onAdd={() => navigation.navigate('AddExpense')} onOpen={openMovement} onSeeAll={() => navigation.navigate('Movements')} />
      )}
      {section === 'obligations' && (
        <Obligations onAdd={() => navigation.navigate('AddObligation')} onOpen={(o) => navigation.navigate('ObligationDetail', { obligationId: o.id, name: o.name })} />
      )}
      {section === 'income' && (
        <IncomeSources onAdd={() => navigation.navigate('AddIncomeSource')} onReceive={(s) => navigation.navigate('AddIncome', { source: s })} />
      )}

      <SectionHeader title="Mes del hogar" />
      <Card padding="md">
        <ListItem title="Cierre del mes" subtitle="Cuánto le toca a cada uno y quién transfiere a quién" leading={<IconCircle name="calculator-outline" tone="primary" />} onPress={() => navigation.navigate('Closing')} divider />
        <ListItem title="Medios de pago" subtitle="Tarjeta de crédito, débito y efectivo" leading={<IconCircle name="card-outline" tone="primary" />} onPress={() => navigation.navigate('PaymentMethods')} divider />
        <ListItem title="Ahorro en común" subtitle="Anotar un depósito" leading={<IconCircle name="trending-up-outline" tone="primary" />} onPress={() => navigation.navigate('AddSavings')} />
      </Card>

      <SectionHeader title="Patrimonio y deudas" />
      <Card padding="md">
        <ListItem title="Vehículos" subtitle="Permiso, revisión técnica, SOAP y seguro" leading={<IconCircle name="car-sport-outline" tone="primary" />} onPress={() => navigation.navigate('Vehicles')} divider />
        <ListItem title="Propiedades" subtitle="Dividendo pagado y arriendo recibido" leading={<IconCircle name="home-outline" tone="primary" />} onPress={() => navigation.navigate('Properties')} divider />
        <ListItem title="Créditos" subtitle="Cuotas pagadas y cuánto falta" leading={<IconCircle name="document-text-outline" tone="primary" />} onPress={() => navigation.navigate('Loans')} />
      </Card>
    </Screen>
  );
}

/** Cuántos movimientos se ven en Cuentas: lo justo para ver lo último sin tapar las secciones de abajo. */
const LATEST = 5;

function Movements({ onAdd, onOpen, onSeeAll }: { onAdd: () => void; onOpen: (m: Movement) => void; onSeeAll: () => void }) {
  const { user, household } = useHousehold();
  // Se pide uno más para saber si hay más que mostrar en "Ver todos".
  const query = useQuery(() => api.listMovements(household.id, user.id, LATEST + 1), [household.id, user.id]);
  return (
    <Card padding="md">
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="Sin movimientos todavía" message="Anota el primer gasto del hogar." action="Agregar gasto" onAction={onAdd} />}
      >
        {(all) => {
          const rows = all.slice(0, LATEST);
          return (
            <>
              {rows.map((m, i) => (
                <MovementRow key={m.key} m={m} onPress={() => onOpen(m)} divider={i < rows.length - 1} />
              ))}
              <Button label="Ver todos los movimientos" variant="ghost" block onPress={onSeeAll} />
            </>
          );
        }}
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
