import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
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
  SegmentedControl,
  Text,
  TextField,
} from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import { useRoutineToggle } from '../../hooks/useRoutineToggle';
import { ExpenseFab } from '../../navigation/ExpenseFab';
import * as api from '../../services/api';
import type { RoutineWithCheck } from '../../services/api';
import { repeatLabel } from '../../utils/weekdays';
import type { BacklogTaskView, Member } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';

type Section = 'today' | 'routines' | 'backlog' | 'ranking';

const pts = (n: number) => `${n} ${n === 1 ? 'pto' : 'pts'}`;

/** Tareas: checklist de hoy, rutinas, backlog con planning poker y ranking de la semana. */
export function TasksScreen() {
  const [section, setSection] = useState<Section>('today');
  return (
    <Screen edges={['top']} overlay={<ExpenseFab />}>
      <Text variant="title" accessibilityRole="header">
        Tareas
      </Text>
      <ShoppingShortcut />
      <SegmentedControl<Section>
        value={section}
        onChange={setSection}
        options={[
          { value: 'today', label: 'Hoy' },
          { value: 'routines', label: 'Rutinas' },
          { value: 'backlog', label: 'Backlog' },
          { value: 'ranking', label: 'Ranking' },
        ]}
      />
      {section === 'today' && <Today />}
      {section === 'routines' && <Routines />}
      {section === 'backlog' && <Backlog />}
      {section === 'ranking' && <Ranking />}
    </Screen>
  );
}

/** Botón a la lista de compras compartida, con cuántas cosas faltan. */
function ShoppingShortcut() {
  const t = useTheme();
  const navigation = useNavigation();
  const { household } = useHousehold();
  const query = useQuery(() => api.listShopping(household.id), [household.id]);
  const pending = query.data?.filter((i) => !i.boughtAt).length;
  const subtitle =
    pending === undefined ? 'Lo que hay que comprar para la casa' : pending === 0 ? 'No falta nada por ahora' : pending === 1 ? 'Falta 1 cosa' : `Faltan ${pending} cosas`;
  return (
    <Card padding="md">
      <ListItem
        title="Lista de compras"
        subtitle={subtitle}
        leading={<IconCircle name="cart-outline" tone="primary" />}
        trailing={<Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />}
        onPress={() => navigation.navigate('Shopping')}
      />
    </Card>
  );
}

function useMembers() {
  const { household } = useHousehold();
  const q = useQuery(() => api.listMembers(household.id), [household.id]);
  const byId = new Map<number, Member>((q.data ?? []).map((m) => [m.id, m]));
  return (id?: number) => (id === undefined ? undefined : byId.get(id)?.displayName.split(' ')[0]);
}

function Today() {
  const { user, household } = useHousehold();
  const query = useQuery(() => api.listRoutines(household.id), [household.id]);
  const toggle = useRoutineToggle(user.id, query.reload);
  const nameOf = useMembers();

  return (
    <QueryView
      query={query}
      isEmpty={(d) => d.length === 0}
      empty={
        <Card>
          <EmptyState title="Sin rutinas" message="Créalas en la pestaña Rutinas: se definen una vez y se repiten cada día o cada semana." />
        </Card>
      }
    >
      {(all) => {
        const rows = all.filter((r) => r.status === 'active' && r.dueToday);
        const pending = all.filter((r) => r.status === 'estimating').length;
        const groups = [
          { title: 'Hoy', items: rows.filter((r) => r.frequency === 'daily') },
          { title: 'Esta semana', items: rows.filter((r) => r.frequency === 'weekly') },
        ].filter((g) => g.items.length > 0);
        return (
          <>
            {pending > 0 && (
              <Text variant="caption" color="textMuted">
                {pending === 1 ? 'Hay 1 rutina en votación' : `Hay ${pending} rutinas en votación`}: aparece aquí cuando la valoren todos (pestaña Rutinas).
              </Text>
            )}
            {groups.length === 0 && (
              <Card>
                <EmptyState title="Hoy no toca nada" message="Ninguna rutina habilitada se repite hoy." />
              </Card>
            )}
            {groups.map((g) => {
              const done = g.items.filter(toggle.isChecked).length;
              return (
                <Card key={g.title} tone="points">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="heading">{g.title}</Text>
                    <Text variant="label" color="points">
                      {done} de {g.items.length}
                    </Text>
                  </View>
                  <ProgressBar value={done / g.items.length} tone="points" accessibilityLabel={`Avance de ${g.title.toLowerCase()}`} />
                  {g.items.map((r) => {
                    const by = nameOf(r.doneBy);
                    return (
                      <Checkbox
                        key={r.id}
                        label={r.name}
                        hint={toggle.isChecked(r) && by ? `Lo hizo ${by} · +${pts(r.points ?? 0)}` : `+${pts(r.points ?? 0)}`}
                        checked={toggle.isChecked(r)}
                        onChange={() => toggle.toggle(r)}
                      />
                    );
                  })}
                </Card>
              );
            })}
            {toggle.error && <Text color="danger">{toggle.error}</Text>}
          </>
        );
      }}
    </QueryView>
  );
}

function Routines() {
  const t = useTheme();
  const { household } = useHousehold();
  const navigation = useNavigation();
  const query = useQuery(() => api.listRoutines(household.id), [household.id]);
  const vote = useMutation(async (routineId: number, points: number) => {
    await api.voteRoutine(routineId, points);
    await query.reload();
  });
  const add = () => navigation.navigate('AddRoutine');
  const every = (r: RoutineWithCheck) => repeatLabel(r);
  return (
    <>
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <Card padding="md">
            <EmptyState title="Sin rutinas" message="Define una vez lo que se hace cada día o cada semana." action="Agregar rutina" onAction={add} />
          </Card>
        }
      >
        {(rows) => {
          const estimating = rows.filter((r) => r.status === 'estimating');
          const active = rows.filter((r) => r.status === 'active');
          return (
            <>
              {estimating.length > 0 && <SectionHeader title="Por valorar" />}
              {estimating.map((r) => (
                <Card key={r.id} padding="md">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{r.name}</Text>
                      <Text variant="caption" color="textMuted">
                        {every(r)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => navigation.navigate('AddRoutine', { routine: r })}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${r.name}`}
                      hitSlop={8}
                      style={({ pressed }) => ({ padding: t.spacing.xs, opacity: pressed ? 0.6 : 1 })}
                    >
                      <Ionicons name="create-outline" size={20} color={t.colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text variant="caption" color="textMuted">
                    {r.myVote ? `Votaste ${r.myVote}. ` : '¿Cuántos puntos vale? '}
                    {r.pendingVoters === 1 ? 'Falta 1 voto' : `Faltan ${r.pendingVoters} votos`}; se habilita con el más alto.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
                    {api.FIBONACCI.map((n) => (
                      <VoteChip key={n} value={n} selected={r.myVote === n} onPress={() => vote.run(r.id, n)} />
                    ))}
                  </View>
                </Card>
              ))}
              {vote.error && <Text color="danger">{vote.error}</Text>}
              {estimating.length > 0 && active.length > 0 && <SectionHeader title="Habilitadas" />}
              <Card padding="md">
                {active.map((r) => (
                  <ListItem
                    key={r.id}
                    title={r.name}
                    subtitle={`${every(r)} · Toca para editar`}
                    trailing={<Badge label={`+${pts(r.points ?? 0)}`} tone="points" />}
                    onPress={() => navigation.navigate('AddRoutine', { routine: r })}
                    divider
                  />
                ))}
                <Button label="Agregar rutina" variant="ghost" block onPress={add} />
              </Card>
            </>
          );
        }}
      </QueryView>
    </>
  );
}

function Backlog() {
  const t = useTheme();
  const navigation = useNavigation();
  const { user, household } = useHousehold();
  const query = useQuery(() => api.listBacklog(household.id, user.id), [household.id, user.id]);
  const nameOf = useMembers();
  const action = useMutation(async (fn: () => Promise<void>) => {
    await fn();
    await query.reload();
  });
  const [title, setTitle] = useState('');

  const add = async () => {
    if (title.trim().length < 3) return;
    await action.run(() => api.addBacklogTask(household.id, user.id, title));
    setTitle('');
  };

  const order: Record<BacklogTaskView['status'], number> = { estimating: 0, open: 1, taken: 2, done: 3 };

  return (
    <>
      <Card padding="md">
        <TextField label="Nueva tarea" value={title} onChangeText={setTitle} placeholder="Ej: Limpiar el horno" onSubmitEditing={add} />
        <Button label="Agregar al backlog" size="sm" variant="secondary" disabled={title.trim().length < 3} onPress={add} />
      </Card>
      {action.error && <Text color="danger">{action.error}</Text>}
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="Backlog vacío" message="Anota tareas únicas: arreglos, limpiezas grandes, trámites." />}
      >
        {(rows) =>
          [...rows]
            .sort((a, b) => order[a.status] - order[b.status])
            .map((task) => (
              <Card key={task.id} padding="md">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {task.title}
                  </Text>
                  {task.points !== undefined && <Badge label={pts(task.points)} tone="points" />}
                  <Pressable
                    onPress={() => navigation.navigate('EditTask', { taskId: task.id, title: task.title })}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${task.title}`}
                    hitSlop={8}
                    style={({ pressed }) => ({ padding: t.spacing.xs, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Ionicons name="create-outline" size={20} color={t.colors.textMuted} />
                  </Pressable>
                </View>
                {task.status === 'estimating' && (
                  <>
                    <Text variant="caption" color="textMuted">
                      {task.myVote ? `Votaste ${task.myVote}. ` : '¿Cuánto esfuerzo es? '}
                      {task.votes.length} {task.votes.length === 1 ? 'voto' : 'votos'}; gana el más alto.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
                      {api.FIBONACCI.map((n) => (
                        <VoteChip key={n} value={n} selected={task.myVote === n} onPress={() => action.run(() => api.voteTask(task.id, user.id, n))} />
                      ))}
                    </View>
                  </>
                )}
                {task.status === 'open' && (
                  <Button label="Me la llevo" size="sm" onPress={() => action.run(() => api.takeTask(task.id, user.id))} />
                )}
                {task.status === 'taken' &&
                  (task.takenBy === user.id ? (
                    <Button label="Terminé" size="sm" onPress={() => action.run(() => api.completeTask(task.id, user.id))} />
                  ) : (
                    <Badge label={`La tomó ${nameOf(task.takenBy) ?? 'alguien'}`} tone="neutral" />
                  ))}
                {task.status === 'done' && <Badge label={`Lista · ${nameOf(task.takenBy) ?? ''}`} tone="success" dot />}
              </Card>
            ))
        }
      </QueryView>
    </>
  );
}

function VoteChip({ value, selected, onPress }: { value: number; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Votar ${value} puntos`}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minWidth: t.sizes.touchMin,
        height: t.sizes.touchMin,
        borderRadius: t.radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? t.colors.points : t.colors.pointsSoft,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text variant="bodyStrong" color={selected ? 'surface' : 'points'}>
        {value}
      </Text>
    </Pressable>
  );
}

function Ranking() {
  const t = useTheme();
  const { household } = useHousehold();
  const query = useQuery(() => api.getRanking(household.id), [household.id]);
  return (
    <>
      <SectionHeader title="Esta semana" />
      <Card padding="md">
        <QueryView query={query}>
          {(rows) => {
            const max = Math.max(1, ...rows.map((r) => r.points));
            return rows.map((r, i) => (
              <View key={r.user.id} style={{ gap: t.spacing.xs }}>
                <ListItem
                  title={`${i + 1}. ${r.user.displayName}`}
                  leading={<Avatar name={r.user.displayName} size="sm" />}
                  trailing={<Badge label={pts(r.points)} tone={i === 0 && r.points > 0 ? 'points' : 'neutral'} />}
                />
                <ProgressBar value={r.points / max} tone="points" accessibilityLabel={`${r.user.displayName}: ${pts(r.points)}`} />
              </View>
            ));
          }}
        </QueryView>
      </Card>
      <Text variant="caption" color="textMuted">
        Suman las rutinas marcadas y las tareas del backlog terminadas desde el lunes.
      </Text>
    </>
  );
}
