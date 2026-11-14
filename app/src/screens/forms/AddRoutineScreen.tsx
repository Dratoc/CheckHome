import { useState } from 'react';
import { Button, ChoiceChips, Screen, SegmentedControl, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Frequency } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';

const POINTS = [1, 2, 3, 5, 8].map((n) => ({ value: n, label: String(n) }));

/** Nueva rutina: se define una vez y se repite cada día o cada semana. */
export function AddRoutineScreen({ navigation }: RootScreenProps<'AddRoutine'>) {
  const { household } = useHousehold();
  const save = useMutation(api.createRoutine);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [points, setPoints] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setSubmitted(true);
    if (name.trim().length < 3) return;
    const r = await save.run(household.id, { name: name.trim(), frequency, points });
    if (r) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Lavar la loza" error={submitted && name.trim().length < 3 ? 'Ponle un nombre.' : undefined} maxLength={100} autoFocus />
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
      {save.error && (
        <Text color="danger" accessibilityRole="alert">
          {save.error}
        </Text>
      )}
      <Button label="Guardar rutina" size="lg" block loading={save.pending} onPress={submit} />
    </Screen>
  );
}
