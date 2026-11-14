import { View } from 'react-native';
import {
  Amount,
  Avatar,
  Badge,
  Card,
  Checkbox,
  EmptyState,
  IconCircle,
  ListItem,
  ProgressBar,
  QueryView,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import { useQuery } from '../../hooks/useQuery';
import { useRoutineToggle } from '../../hooks/useRoutineToggle';
import { ExpenseFab } from '../../navigation/ExpenseFab';
import type { TabScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { monthName, today } from '../../utils/dates';
import { obligationBadge, obligationIcon, obligationSubtitle } from './obligationUi';

/** Inicio: balance del mes, próximos vencimientos y checklist de hoy. */
export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const summary = useQuery(() => api.getMonthSummary(household.id, user.id), [household.id, user.id]);
  const obligations = useQuery(() => api.listObligations(household.id), [household.id]);
  const routines = useQuery(() => api.listRoutines(household.id), [household.id]);
  const toggle = useRoutineToggle(user.id, routines.reload);

  const upcoming = (obligations.data ?? []).filter((o) => o.status !== 'ok').slice(0, 3);
  const daily = (routines.data ?? []).filter((r) => r.frequency === 'daily');
  const done = daily.filter(toggle.isChecked).length;

  return (
    <Screen edges={['top']} overlay={<ExpenseFab />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: t.spacing.xxs, flex: 1 }}>
          <Text variant="overline" color="textMuted">
            {household.name}
          </Text>
          <Text variant="title" accessibilityRole="header">
            Hola, {user.displayName.split(' ')[0]}
          </Text>
        </View>
        <Avatar name={user.displayName} size="lg" />
      </View>

      <Card tone="tinted" onPress={() => navigation.navigate('Accounts')} accessibilityLabel="Ver cuentas del mes">
        <Text variant="label" color="textMuted">
          Balance de {monthName(today())}
        </Text>
        <QueryView query={summary}>
          {(s) => (
            <>
              <Amount value={s.balance} sign={s.balance < 0 ? 'expense' : 'none'} size="display" />
              <View style={{ flexDirection: 'row', gap: t.spacing.lg, flexWrap: 'wrap' }}>
                <Text variant="caption" color="textMuted">
                  Entró <Amount value={s.income} sign="income" variant="caption" />
                </Text>
                <Text variant="caption" color="textMuted">
                  Gastos <Amount value={s.expenses + s.fixedPaid} variant="caption" />
                </Text>
                <Text variant="caption" color="textMuted">
                  Por pagar <Amount value={s.fixedPending} variant="caption" />
                </Text>
              </View>
            </>
          )}
        </QueryView>
      </Card>

      <SectionHeader title="Próximos vencimientos" action="Ver todo" onAction={() => navigation.navigate('Accounts')} />
      <Card padding="md">
        <QueryView
          query={obligations}
          isEmpty={() => upcoming.length === 0}
          empty={<EmptyState title="Todo al día" message="No hay cuentas atrasadas ni por vencer esta semana." />}
        >
          {() =>
            upcoming.map((o, i) => {
              const b = obligationBadge(o);
              return (
                <ListItem
                  key={o.id}
                  title={o.name}
                  subtitle={obligationSubtitle(o)}
                  leading={<IconCircle name={obligationIcon[o.kind]} tone={o.status === 'overdue' ? 'danger' : 'warning'} />}
                  trailing={
                    <View style={{ alignItems: 'flex-end', gap: t.spacing.xxs }}>
                      <Amount value={o.amountClp} />
                      <Badge label={b.label} tone={b.tone} />
                    </View>
                  }
                  divider={i < upcoming.length - 1}
                  onPress={() => navigation.navigate('Accounts')}
                />
              );
            })
          }
        </QueryView>
      </Card>

      <SectionHeader title="Hoy en la casa" action="Tareas" onAction={() => navigation.navigate('Tasks')} />
      <Card tone="points">
        <QueryView
          query={routines}
          isEmpty={() => daily.length === 0}
          empty={<EmptyState title="Sin rutinas diarias" message="Crea rutinas en la pestaña Tareas para repartir la casa." />}
        >
          {() => (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="label" color="points">
                  {done} de {daily.length} listas
                </Text>
                <Text variant="label" color="points">
                  {Math.round((done / daily.length) * 100)}%
                </Text>
              </View>
              <ProgressBar value={done / daily.length} tone="points" accessibilityLabel="Avance de las rutinas de hoy" />
              {daily.map((r) => (
                <Checkbox
                  key={r.id}
                  label={r.name}
                  hint={`+${r.points} ${r.points === 1 ? 'pto' : 'pts'}`}
                  checked={toggle.isChecked(r)}
                  onChange={() => toggle.toggle(r)}
                />
              ))}
              {toggle.error && <Text color="danger">{toggle.error}</Text>}
            </>
          )}
        </QueryView>
      </Card>
    </Screen>
  );
}
