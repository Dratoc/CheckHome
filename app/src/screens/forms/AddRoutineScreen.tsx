import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, ChoiceChips, Screen, SegmentedControl, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Frequency } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { confirmDanger } from '../../utils/confirm';
import { ALL_DAYS, DAY_NAMES, DAY_SHORT } from '../../utils/weekdays';

const POINTS = api.FIBONACCI.map((n) => ({ value: n, label: String(n) }));

const saveRoutine = (householdId: number, routineId: number | undefined, input: api.RoutineInput & { points: number }) =>
  routineId ? api.updateRoutine(routineId, { name: input.name, frequency: input.frequency, days: input.days }) : api.createRoutine(householdId, input);

/**
 * Nueva rutina: se define una vez y se repite cada día o cada semana. Nace en votación: los puntos que elige quien la
 * crea son su voto, y se habilita cuando votaron todos, con el voto más alto. Con routine, edita nombre y frecuencia.
 */
export function AddRoutineScreen({ navigation, route }: RootScreenProps<'AddRoutine'>) {
  const { household } = useHousehold();
  const routine = route.params?.routine;
  const save = useMutation(saveRoutine);
  const remove = useMutation(api.deleteRoutine);
  const [name, setName] = useState(routine?.name ?? '');
  const [frequency, setFrequency] = useState<Frequency>(routine?.frequency ?? 'daily');
  const [days, setDays] = useState<number[]>(routine?.days ?? ALL_DAYS);
  const [points, setPoints] = useState<number>(1);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setSubmitted(true);
    if (name.trim().length < 3 || (frequency === 'daily' && days.length === 0)) return;
    const r = await save.run(household.id, routine?.id, { name: name.trim(), frequency, days: frequency === 'daily' ? days : undefined, points });
    if (r) navigation.goBack();
  };

  const onDelete = async () => {
    if (!routine) return;
    const ok = await confirmDanger(`¿Eliminar ${routine.name}?`, 'Sus marcas y puntos salen del ranking. No se puede recuperar.');
    if (ok && (await remove.run(routine.id))) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Lavar la loza" error={submitted && name.trim().length < 3 ? 'Ponle un nombre.' : undefined} maxLength={100} autoFocus={!routine} />
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
