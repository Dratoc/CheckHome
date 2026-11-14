import { useState } from 'react';
import { Button, ChoiceChips, Screen, SegmentedControl, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Frequency } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';

const POINTS = api.FIBONACCI.map((n) => ({ value: n, label: String(n) }));

const saveRoutine = (householdId: number, routineId: number | undefined, input: api.RoutineInput & { points: number }) =>
  routineId ? api.updateRoutine(routineId, { name: input.name, frequency: input.frequency }) : api.createRoutine(householdId, input);

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
  const [points, setPoints] = useState<number>(1);
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
