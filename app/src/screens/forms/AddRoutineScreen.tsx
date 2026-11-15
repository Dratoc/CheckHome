import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, ChoiceChips, Screen, SegmentedControl, Text, TextField } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Frequency, TaskCategory } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { confirmDanger } from '../../utils/confirm';
import { ALL_DAYS, DAY_NAMES, DAY_SHORT } from '../../utils/weekdays';
import { CATEGORIES, PET_ROUTINES, speciesEmoji, suggestCategory } from '../../utils/categories';

const POINTS = api.FIBONACCI.map((n) => ({ value: n, label: String(n) }));

const saveRoutine = (householdId: number, routineId: number | undefined, { points, ...input }: api.RoutineInput & { points: number }) =>
  routineId ? api.updateRoutine(routineId, input) : api.createRoutine(householdId, { ...input, points });

type CategoryChoice = TaskCategory | 'none';
const CATEGORY_CHOICES = [...CATEGORIES.map((c) => ({ value: c.value as CategoryChoice, label: c.label, icon: c.icon })), { value: 'none' as CategoryChoice, label: 'Sin categoría' }];

/** De quién es: 'house', 'p12' (mascota 12) o 'v3' (vehículo 3). */
type SubjectKey = string;
const subjectKey = (petId?: number, vehicleId?: number): SubjectKey => (petId ? `p${petId}` : vehicleId ? `v${vehicleId}` : 'house');

/**
 * Nueva rutina: se define una vez y se repite cada día o cada semana. Nace en votación: los puntos que elige quien la
 * crea son su voto, y se habilita cuando votaron todos, con el voto más alto. Con routine, edita nombre y frecuencia.
 */
export function AddRoutineScreen({ navigation, route }: RootScreenProps<'AddRoutine'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const routine = route.params?.routine;
  const save = useMutation(saveRoutine);
  const pets = useQuery(() => api.listPets(household.id), [household.id]);
  const vehicles = useQuery(() => api.listVehicles(household.id), [household.id]);
  const [subject, setSubject] = useState<SubjectKey>(subjectKey(routine?.petId ?? route.params?.petId, routine?.vehicleId ?? route.params?.vehicleId));
  const [chosenCategory, setChosenCategory] = useState<CategoryChoice | undefined>(routine ? (routine.category ?? 'none') : undefined);
  const remove = useMutation(api.deleteRoutine);
  const [name, setName] = useState(routine?.name ?? '');
  const [frequency, setFrequency] = useState<Frequency>(routine?.frequency ?? 'daily');
  const [days, setDays] = useState<number[]>(routine?.days ?? ALL_DAYS);
  const [points, setPoints] = useState<number>(1);
  const [submitted, setSubmitted] = useState(false);

  const petId = subject.startsWith('p') ? Number(subject.slice(1)) : undefined;
  const vehicleId = subject.startsWith('v') ? Number(subject.slice(1)) : undefined;
  const pet = pets.data?.find((p) => p.id === petId);
  // Hasta que la persona elija, la categoría se sugiere sola por el nombre. Si es de una mascota o auto, va ahí.
  const category: CategoryChoice = petId ? 'pets' : vehicleId ? 'vehicles' : (chosenCategory ?? suggestCategory(name) ?? 'none');
  const subjectOptions = [
    { value: 'house', label: 'De la casa' },
    ...(pets.data ?? []).map((p) => ({ value: `p${p.id}`, label: `${speciesEmoji(p.species)} ${p.name}` })),
    ...(vehicles.data ?? []).map((v) => ({ value: `v${v.id}`, label: `🚗 ${v.name}` })),
  ];

  const submit = async () => {
    setSubmitted(true);
    if (name.trim().length < 2 || (frequency === 'daily' && days.length === 0)) return;
    const r = await save.run(household.id, routine?.id, {
      name: name.trim(),
      frequency,
      days: frequency === 'daily' ? days : undefined,
      points,
      category: category === 'none' ? null : category,
      petId: petId ?? null,
      vehicleId: vehicleId ?? null,
    });
    if (r) navigation.goBack();
  };

  const onDelete = async () => {
    if (!routine) return;
    const ok = await confirmDanger(`¿Eliminar ${routine.name}?`, 'Sus marcas y puntos salen del ranking. No se puede recuperar.');
    if (ok && (await remove.run(routine.id))) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      {subjectOptions.length > 1 && <ChoiceChips label="¿De quién es?" options={subjectOptions} value={subject} onChange={setSubject} />}
      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder={pet ? 'Ej: Comida' : 'Ej: Lavar la loza'}
        error={submitted && name.trim().length < 2 ? 'Ponle un nombre.' : undefined}
        maxLength={100}
        autoFocus={!routine && !route.params?.petId && !route.params?.vehicleId}
      />
      {pet && !routine && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
          {PET_ROUTINES.map((p) => (
            <Button key={p.name} label={p.name} size="sm" variant={name === p.name ? 'secondary' : 'ghost'} onPress={() => setName(p.name)} />
          ))}
        </View>
      )}
      {!petId && !vehicleId && (
        <ChoiceChips label={chosenCategory === undefined && category !== 'none' ? 'Categoría (sugerida)' : 'Categoría'} options={CATEGORY_CHOICES} value={category} onChange={setChosenCategory} />
      )}
      <SegmentedControl<Frequency>
        value={frequency}
        onChange={setFrequency}
        options={[
          { value: 'daily', label: 'Días de la semana' },
          { value: 'weekly', label: 'Una vez por semana' },
        ]}
      />
      {frequency === 'daily' ? (
        <DayPicker value={days} onChange={setDays} error={submitted && days.length === 0 ? 'Elige al menos un día.' : undefined} />
      ) : (
        <Text variant="caption" color="textMuted">
          Se hace una vez, el día que se pueda de la semana.
        </Text>
      )}
      {!routine && <ChoiceChips label="Tu valoración (puntos)" options={POINTS} value={points} onChange={setPoints} />}
      <Text variant="caption" color="textMuted">
        {!routine
          ? 'Todos los de la casa la valoran antes de habilitarla y queda con el voto más alto. Quien la marca suma esos puntos en el ranking.'
          : routine.status === 'estimating'
            ? 'Está en votación: los puntos se valoran en la pestaña Rutinas y queda con el voto más alto.'
            : `Vale ${routine.points} ${routine.points === 1 ? 'punto' : 'puntos'}: el voto más alto de la casa.`}
      </Text>
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      <Button label={routine ? 'Guardar cambios' : 'Guardar rutina'} size="lg" block loading={save.pending} onPress={submit} />
      {routine && <Button label="Eliminar rutina" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}

/** Días en que se repite: varios a la vez. Atajos para todos los días y de lunes a viernes. */
function DayPicker({ value, onChange, error }: { value: number[]; onChange: (days: number[]) => void; error?: string }) {
  const t = useTheme();
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  const preset = (days: number[], label: string) => {
    const selected = days.length === value.length && days.every((d) => value.includes(d));
    return <Button key={label} label={label} size="sm" variant={selected ? 'secondary' : 'ghost'} onPress={() => onChange(days)} />;
  };
  return (
    <View style={{ gap: t.spacing.sm }}>
      <Text variant="label">Qué días</Text>
      <View style={{ flexDirection: 'row', gap: t.spacing.xs, justifyContent: 'space-between' }}>
        {ALL_DAYS.map((d) => {
          const selected = value.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggle(d)}
              accessibilityRole="checkbox"
              accessibilityLabel={DAY_NAMES[d - 1]}
              accessibilityState={{ checked: selected }}
              style={({ pressed }) => ({
                flex: 1,
                height: t.sizes.touchMin,
                borderRadius: t.radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? t.colors.points : t.colors.pointsSoft,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text variant="bodyStrong" color={selected ? 'surface' : 'points'}>
                {DAY_SHORT[d - 1]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
        {preset(ALL_DAYS, 'Todos los días')}
        {preset([1, 2, 3, 4, 5], 'Lunes a viernes')}
        {preset([6, 7], 'Fin de semana')}
      </View>
      {error && (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}
