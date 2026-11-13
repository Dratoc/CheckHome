import { useState } from 'react';
import { Button, ChoiceChips, Screen, SegmentedControl, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Frequency } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';

const POINTS = [1, 2, 3, 5, 8].map((n) => ({ value: n, label: String(n) }));

const saveRoutine = (householdId: number, routineId: number | undefined, input: api.RoutineInput) =>
  routineId ? api.updateRoutine(routineId, input) : api.createRoutine(householdId, input);

/** Nueva rutina: se define una vez y se repite cada día o cada semana. Con routine, la edita. */
export function AddRoutineScreen({ navigation, route }: RootScreenProps<'AddRoutine'>) {
  const { household } = useHousehold();
  const routine = route.params?.routine;
  const save = useMutation(saveRoutine);
  const remove = useMutation(api.deleteRoutine);
  const [name, setName] = useState(routine?.name ?? '');
  const [frequency, setFrequency] = useState<Frequency>(routine?.frequency ?? 'daily');
  const [points, setPoints] = useState(routine?.points ?? 1);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setSubmitted(true);
    if (name.trim().length < 3) return;
    const r = await save.run(household.id, routine?.id, { name: name.trim(), frequency, points });
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
          { value: 'daily', label: 'Todos los días' },
          { value: 'weekly', label: 'Una vez por semana' },
        ]}
      />
      <ChoiceChips label="Puntos" options={POINTS} value={points} onChange={setPoints} />
      <Text variant="caption" color="textMuted">
        Quien la marca suma estos puntos en el ranking de la semana.
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
