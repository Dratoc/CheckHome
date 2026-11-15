import { View } from 'react-native';
import {
  Amount,
  Avatar,
  Badge,
  Button,
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
import { SubjectsStrip } from '../subjects/SubjectsStrip';
import { obligationBadge, obligationIcon, obligationSubtitle } from './obligationUi';

/** Inicio: balance del mes, mascotas y autos con su estado de hoy, próximos vencimientos y checklist de hoy. */
export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const summary = useQuery(() => api.getMonthSummary(household.id, user.id), [household.id, user.id]);
  const obligations = useQuery(() => api.listObligations(household.id), [household.id]);
  const routines = useQuery(() => api.listRoutines(household.id), [household.id]);
  const toggle = useRoutineToggle(user.id, routines.reload);
  const pets = useQuery(() => api.listPets(household.id), [household.id]);
  const vehicles = useQuery(() => api.listVehicles(household.id), [household.id]);
  const petList = pets.data ?? [];
  const vehicleList = vehicles.data ?? [];
  const subjectsTitle = petList.length && vehicleList.length ? 'Mascotas y autos' : petList.length ? 'Mascotas' : 'Vehículos';

  const upcoming = (obligations.data ?? []).filter((o) => o.status !== 'ok').slice(0, 3);
  // Inicio muestra solo lo mío por hacer y el avance de la casa; la lista completa está en Tareas.
  const due = (routines.data ?? []).filter((r) => r.status === 'active' && r.dueToday);
  const done = due.filter(toggle.isChecked).length;
  const mine = due.filter((r) => r.claimedBy === user.id && !toggle.isChecked(r));
  const free = due.filter((r) => r.claimedBy === undefined && !toggle.isChecked(r)).length;

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

      {petList.length + vehicleList.length > 0 && (
        <>
          <SectionHeader title={subjectsTitle} action={petList.length ? 'Ver mascotas' : 'Ver autos'} onAction={() => navigation.navigate(petList.length ? 'Pets' : 'Vehicles')} />
          <SubjectsStrip
            pets={petList}
            vehicles={vehicleList}
            routines={routines.data ?? []}
            toggle={toggle}
            onOpenPet={(p) => navigation.navigate('Pet', { petId: p.id, name: p.name })}
            onOpenVehicle={() => navigation.navigate('Vehicles')}
          />
        </>
      )}

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
                  onPress={() => navigation.navigate('ObligationDetail', { obligationId: o.id, name: o.name })}
                  divider={i < upcoming.length - 1}
                />
              );
            })
          }
        </QueryView>
      </Card>

      <SectionHeader title="Mis tareas de hoy" action="Tareas" onAction={() => navigation.navigate('Tasks')} />
      <Card tone="points">
        <QueryView
          query={routines}
          isEmpty={() => due.length === 0}
          empty={<EmptyState title="Sin rutinas para hoy" message="Crea rutinas en la pestaña Tareas para repartir la casa." />}
        >
          {() => (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="label" color="points">
                  La casa lleva {done} de {due.length}
                </Text>
                <Text variant="label" color="points">
                  {Math.round((done / due.length) * 100)}%
                </Text>
              </View>
              <ProgressBar value={done / due.length} tone="points" accessibilityLabel="Avance de la casa hoy" />
              {mine.map((r) => (
                <Checkbox
                  key={r.id}
                  label={r.name}
                  hint={`${r.frequency === 'daily' ? 'Hoy' : 'Esta semana'} · +${r.points ?? 0} ${r.points === 1 ? 'pto' : 'pts'}`}
                  checked={false}
                  onChange={() => toggle.toggle(r)}
                />
              ))}
              {mine.length === 0 && (
                <Text variant="caption" color="textMuted">
                  {free > 0
                    ? `No tienes tareas por hacer. ${free === 1 ? 'Queda 1 libre' : `Quedan ${free} libres`} en la casa.`
                    : 'No tienes tareas por hacer.'}
                </Text>
              )}
              {mine.length === 0 && free > 0 && (
                <Button label="Elegir tareas" size="sm" variant="secondary" onPress={() => navigation.navigate('Tasks')} />
              )}
              {toggle.error && <Text color="danger">{toggle.error}</Text>}
            </>
          )}
        </QueryView>
      </Card>
    </Screen>
  );
}
