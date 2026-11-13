import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
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
          <EmptyState title="Sin rutinas" message="Las rutinas se definen una vez y se repiten cada día o cada semana." />
        </Card>
      }
    >
      {(rows) => {
        const groups = [
          { title: 'Hoy', items: rows.filter((r) => r.frequency === 'daily') },
          { title: 'Esta semana', items: rows.filter((r) => r.frequency === 'weekly') },
        ].filter((g) => g.items.length > 0);
        return (
          <>
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
                        hint={toggle.isChecked(r) && by ? `Lo hizo ${by} · +${pts(r.points)}` : `+${pts(r.points)}`}
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
  const { household } = useHousehold();
  const query = useQuery(() => api.listRoutines(household.id), [household.id]);
  return (
    <Card padding="md">
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Sin rutinas" message="Pronto podrás crearlas desde aquí." />}>
        {(rows) =>
          rows.map((r, i) => (
            <ListItem
              key={r.id}
              title={r.name}
              subtitle={r.frequency === 'daily' ? 'Todos los días' : 'Una vez por semana'}
              trailing={<Badge label={`+${pts(r.points)}`} tone="points" />}
              divider={i < rows.length - 1}
            />
          ))
        }
      </QueryView>
    </Card>
  );
}

function Backlog() {
  const t = useTheme();
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
