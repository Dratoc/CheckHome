import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CategoryFilter,
  Checkbox,
  countByCategory,
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
  TextField,
} from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import { useRoutineToggle } from '../../hooks/useRoutineToggle';
import * as api from '../../services/api';
import type { RoutineWithCheck } from '../../services/api';
import { repeatLabel } from '../../utils/weekdays';
import type { BacklogTaskView, Member, TaskCategory } from '../../services/types';
import { categoryInfo, speciesEmoji } from '../../utils/categories';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';

type Section = 'today' | 'routines' | 'backlog' | 'ranking';

const pts = (n: number) => `${n} ${n === 1 ? 'pto' : 'pts'}`;

/** Tareas: checklist de hoy, rutinas, backlog con planning poker y ranking de la semana. */
export function TasksScreen() {
  const [section, setSection] = useState<Section>('today');
  // El filtro de categoría se mantiene al cambiar entre Hoy, Rutinas y Backlog.
  const [category, setCategory] = useState<TaskCategory>();
  const filter = { category, setCategory };
  const navigation = useNavigation();
  // Aquí no se anotan gastos: el botón flotante solo aparece en Rutinas, para agregar una. Backlog ya tiene su campo.
  const fab = section === 'routines' ? <Fab label="Rutina" accessibilityLabel="Agregar rutina" onPress={() => navigation.navigate('AddRoutine')} /> : undefined;
  return (
    <Screen edges={['top']} overlay={fab}>
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
      {section === 'today' && <Today {...filter} />}
      {section === 'routines' && <Routines {...filter} />}
      {section === 'backlog' && <Backlog {...filter} />}
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

type FilterProps = { category: TaskCategory | undefined; setCategory: (c: TaskCategory | undefined) => void };

/**
 * Cómo se presenta una tarea en la lista: el nombre de su mascota o vehículo ("🐶 Luna"), o si no, su categoría
 * ("Cocina"). Así "Comida" de cada mascota se distingue sin tener que escribir el nombre en la tarea.
 */
function useTaskContext() {
  const { household } = useHousehold();
  const pets = useQuery(() => api.listPets(household.id), [household.id]);
  const vehicles = useQuery(() => api.listVehicles(household.id), [household.id]);
  return (r: { category?: TaskCategory; petId?: number; vehicleId?: number }) => {
    const pet = r.petId ? pets.data?.find((p) => p.id === r.petId) : undefined;
    if (pet) return `${speciesEmoji(pet.species)} ${pet.name}`;
    const vehicle = r.vehicleId ? vehicles.data?.find((v) => v.id === r.vehicleId) : undefined;
    if (vehicle) return `🚗 ${vehicle.name}`;
    return categoryInfo(r.category)?.label;
  };
}

const withContext = (context: string | undefined, rest: string) => (context ? `${context} · ${rest}` : rest);
const matches = (category: TaskCategory | undefined) => (x: { category?: TaskCategory }) => !category || x.category === category;

type Scope = 'mine' | 'house';

/** Hoy: por defecto solo lo que falta. "Mías" es lo que elegí hacer; "De la casa", todo lo que toca hoy. */
function Today({ category, setCategory }: FilterProps) {
  const t = useTheme();
  const contextOf = useTaskContext();
  const { user, household } = useHousehold();
  const query = useQuery(() => api.listRoutines(household.id), [household.id]);
  const backlog = useQuery(() => api.listBacklog(household.id, user.id), [household.id, user.id]);
  const toggle = useRoutineToggle(user.id, query.reload);
  const nameOf = useMembers();
  const [chosen, setChosen] = useState<Scope>();
  const [showDone, setShowDone] = useState(false);
  const action = useMutation(async (fn: () => Promise<void>, reload: () => Promise<void>) => {
    await fn();
    await reload();
  });
  const claim = (r: RoutineWithCheck) => action.run(() => api.claimRoutine(r.id), query.reload);
  const release = (r: RoutineWithCheck) => action.run(() => api.releaseRoutine(r.id), query.reload);
  const finishTask = (task: BacklogTaskView) => action.run(() => api.completeTask(task.id, user.id), backlog.reload);

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
        const dueAll = all.filter((r) => r.status === 'active' && r.dueToday);
        const myTasksAll = (backlog.data ?? []).filter((task) => task.status === 'taken' && task.takenBy === user.id);
        const counts = countByCategory([...dueAll.filter((r) => !toggle.isChecked(r)), ...myTasksAll]);
        const due = dueAll.filter(matches(category));
        const estimating = all.filter((r) => r.status === 'estimating').length;
        const todo = due.filter((r) => !toggle.isChecked(r));
        const done = due.filter(toggle.isChecked);
        const mineTodo = todo.filter((r) => r.claimedBy === user.id);
        const myTasks = myTasksAll.filter(matches(category));
        const mineDone = done.filter((r) => r.doneBy === user.id || (r.doneBy === undefined && r.claimedBy === user.id));
        const mineCount = mineTodo.length + myTasks.length;
        // Si no he elegido nada, parto viendo la casa para elegir; si ya tengo tareas, parto en las mías.
        const scope: Scope = chosen ?? (mineCount + mineDone.length > 0 ? 'mine' : 'house');
        // Al tocar algo, la vista queda fija: no salta de "De la casa" a "Mis tareas" al tomar la primera.
        const hold = (fn: () => unknown) => () => {
          setChosen(scope);
          fn();
        };
        const pending = scope === 'mine' ? mineTodo : todo;
        const finished = scope === 'mine' ? mineDone : done;
        const total = pending.length + finished.length + (scope === 'mine' ? myTasks.length : 0);
        const free = todo.filter((r) => r.claimedBy === undefined);
        const taken = todo.filter((r) => r.claimedBy !== undefined);

        const when = (r: RoutineWithCheck) => (r.frequency === 'daily' ? 'Hoy' : 'Esta semana');
        const ownerBadge = (r: RoutineWithCheck) =>
          r.claimedBy === user.id ? <Badge label="Tuya" tone="primary" /> : <Badge label={nameOf(r.claimedBy) ?? 'Tomada'} tone="neutral" />;

        return (
          <>
            <FilterPills<Scope>
              value={scope}
              onChange={(v) => {
                setChosen(v);
                setShowDone(false);
              }}
              options={[
                { value: 'mine', label: 'Mis tareas', count: mineCount },
                { value: 'house', label: 'De la casa', count: todo.length },
              ]}
            />
            <CategoryFilter value={category} onChange={setCategory} counts={counts} />
            {category && total === 0 && (
              <Text variant="caption" color="textMuted">
                Nada de {categoryInfo(category)?.label.toLowerCase()} {scope === 'mine' ? 'en tus tareas' : 'en la casa'} por ahora.
              </Text>
            )}

            {total > 0 && (
              <View style={{ gap: t.spacing.xs }}>
                <Text variant="label" color="textMuted">
                  {scope === 'mine'
                    ? `Hiciste ${finished.length} de ${total}`
                    : `La casa lleva ${finished.length} de ${total}`}
                </Text>
                <ProgressBar value={finished.length / total} tone="points" accessibilityLabel="Avance de hoy" />
              </View>
            )}

            {!category && scope === 'mine' && mineCount === 0 && (
              <Card>
                <EmptyState
                  title={finished.length > 0 ? '¡Listo por hoy!' : 'Aún no eliges tareas'}
                  message={
                    finished.length > 0
                      ? 'Hiciste todo lo que elegiste. Si te animas, en la casa quedan tareas libres.'
                      : 'Mira las tareas de la casa y toca "Me la llevo" en las que vas a hacer.'
                  }
                  action={free.length > 0 ? 'Ver tareas de la casa' : undefined}
                  onAction={() => setChosen('house')}
                />
              </Card>
            )}

            {scope === 'mine' && mineCount > 0 && (
              <Card tone="points">
                {mineTodo.map((r) => (
                  <TaskRow
                    key={`r${r.id}`}
                    label={r.name}
                    hint={withContext(contextOf(r), `${when(r)} · +${pts(r.points ?? 0)}`)}
                    onDone={hold(() => toggle.toggle(r))}
                    trailing={<Button label="Soltar" size="sm" variant="ghost" onPress={hold(() => release(r))} />}
                  />
                ))}
                {myTasks.map((task) => (
                  <TaskRow
                    key={`t${task.id}`}
                    label={task.title}
                    hint={withContext(contextOf(task), `Backlog · +${pts(task.points ?? 0)}`)}
                    onDone={hold(() => finishTask(task))}
                  />
                ))}
              </Card>
            )}

            {!category && scope === 'house' && todo.length === 0 && (
              <Card>
                <EmptyState
                  title={done.length > 0 ? 'La casa está al día' : 'Hoy no toca nada'}
                  message={done.length > 0 ? 'Ya se hizo todo lo de hoy.' : 'Ninguna rutina habilitada se repite hoy.'}
                />
              </Card>
            )}

            {scope === 'house' && free.length > 0 && (
              <>
                <SectionHeader title={`Libres (${free.length})`} />
                <Card tone="points">
                  {free.map((r) => (
                    <TaskRow
                      key={r.id}
                      label={r.name}
                      hint={withContext(contextOf(r), `${when(r)} · +${pts(r.points ?? 0)}`)}
                      onDone={hold(() => toggle.toggle(r))}
                      trailing={<Button label="Me la llevo" size="sm" variant="secondary" onPress={hold(() => claim(r))} />}
                    />
                  ))}
                </Card>
              </>
            )}

            {scope === 'house' && taken.length > 0 && (
              <>
                <SectionHeader title={`Ya tienen dueño (${taken.length})`} />
                <Card>
                  {taken.map((r) => (
                    <TaskRow key={r.id} label={r.name} hint={withContext(contextOf(r), `${when(r)} · +${pts(r.points ?? 0)}`)} onDone={hold(() => toggle.toggle(r))} trailing={ownerBadge(r)} />
                  ))}
                </Card>
              </>
            )}

            {scope === 'house' && estimating > 0 && (
              <Text variant="caption" color="textMuted">
                {estimating === 1 ? 'Hay 1 rutina en votación' : `Hay ${estimating} rutinas en votación`}: aparece aquí cuando la valoren todos (pestaña Rutinas).
              </Text>
            )}

            {finished.length > 0 && (
              <DoneSection count={finished.length} open={showDone} onToggle={() => setShowDone((v) => !v)} title="Hechas">
                {finished.map((r) => {
                  const by = nameOf(r.doneBy);
                  return (
                    <Checkbox
                      key={r.id}
                      label={r.name}
                      hint={`${by && r.doneBy !== user.id ? `Lo hizo ${by}` : 'La hiciste tú'} · +${pts(r.points ?? 0)} · Toca para deshacer`}
                      checked
                      onChange={hold(() => toggle.toggle(r))}
                    />
                  );
                })}
              </DoneSection>
            )}

            {toggle.error && <Text color="danger">{toggle.error}</Text>}
            {action.error && <Text color="danger">{action.error}</Text>}
          </>
        );
      }}
    </QueryView>
  );
}

/** Fila por hacer: la casilla la marca hecha (y sale de la lista); a la derecha, una acción o quién la tiene. */
function TaskRow({ label, hint, onDone, trailing }: { label: string; hint: string; onDone: () => void; trailing?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Checkbox label={label} hint={hint} checked={false} onChange={onDone} />
      </View>
      {trailing}
    </View>
  );
}

/** Filtro de dos o tres opciones en forma de píldoras, con un contador al lado. */
function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.count === undefined ? o.label : `${o.label}, ${o.count} por hacer`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.xs,
              minHeight: t.sizes.touchMin,
              paddingHorizontal: t.spacing.md,
              borderRadius: t.radii.pill,
              backgroundColor: selected ? t.colors.primary : t.colors.surfaceAlt,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
              {o.label}
            </Text>
            {o.count !== undefined && (
              <Text variant="label" color={selected ? 'onPrimary' : 'textMuted'}>
                {o.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Sección plegable para lo ya hecho: cerrada por defecto, para que la lista muestre solo lo que falta. */
function DoneSection({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? 'Ocultar' : 'Ver'} ${title.toLowerCase()} (${count})`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.xs,
          minHeight: t.sizes.touchMin,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={t.colors.textMuted} />
        <Text variant="label" color="textMuted">
          {title} ({count})
        </Text>
      </Pressable>
      {open && <Card>{children}</Card>}
    </>
  );
}

function Routines({ category, setCategory }: FilterProps) {
  const t = useTheme();
  const contextOf = useTaskContext();
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
        {(all) => {
          const rows = all.filter(matches(category));
          const estimating = rows.filter((r) => r.status === 'estimating');
          const active = rows.filter((r) => r.status === 'active');
          return (
            <>
              <CategoryFilter value={category} onChange={setCategory} counts={countByCategory(all)} />
              {estimating.length > 0 && <SectionHeader title="Por valorar" />}
              {estimating.map((r) => (
                <Card key={r.id} padding="md">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{r.name}</Text>
                      <Text variant="caption" color="textMuted">
                        {withContext(contextOf(r), every(r))}
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
                    subtitle={withContext(contextOf(r), `${every(r)} · Toca para editar`)}
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

function Backlog({ category, setCategory }: FilterProps) {
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
  const [showDone, setShowDone] = useState(false);

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
        {(all) => {
          const rows = all.filter(matches(category));
          const active = [...rows].filter((task) => task.status !== 'done').sort((a, b) => order[a.status] - order[b.status]);
          const done = rows.filter((task) => task.status === 'done');
          const renderTask = (task: BacklogTaskView) => (
            <Card key={task.id} padding="md">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {task.title}
                </Text>
                {task.points !== undefined && <Badge label={pts(task.points)} tone="points" />}
                <Pressable
                  onPress={() => navigation.navigate('EditTask', { taskId: task.id, title: task.title, category: task.category })}
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
            </Card>
          );
          return (
            <>
              <CategoryFilter value={category} onChange={setCategory} counts={countByCategory(all.filter((task) => task.status !== 'done'))} />
              {active.length === 0 && (
                <EmptyState
                  title="Nada pendiente"
                  message={category ? `No hay tareas de ${categoryInfo(category)?.label.toLowerCase()} pendientes.` : 'Todas las tareas del backlog están terminadas.'}
                />
              )}
              {active.map(renderTask)}
              {done.length > 0 && (
                <DoneSection title="Terminadas" count={done.length} open={showDone} onToggle={() => setShowDone((v) => !v)}>
                  {done.map((task) => (
                    <ListItem
                      key={task.id}
                      title={task.title}
                      subtitle={`La hizo ${nameOf(task.takenBy) ?? 'alguien'}${task.points !== undefined ? ` · ${pts(task.points)}` : ''}`}
                      onPress={() => navigation.navigate('EditTask', { taskId: task.id, title: task.title, category: task.category })}
                      divider
                    />
                  ))}
                </DoneSection>
              )}
            </>
          );
        }}
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
