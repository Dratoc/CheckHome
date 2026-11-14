import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import * as api from '../../services/api';
import { useSession } from '../../state/SessionProvider';

export function CreateHouseholdScreen() {
  const { user, selectHousehold } = useSession();
  const [name, setName] = useState('');
  const { run, pending, error } = useMutation(api.createHousehold);
  const valid = name.trim().length >= 2;

  const submit = async () => {
    if (!valid) return;
    const h = await run(user!.id, name);
    if (h) selectHousehold(h);
  };

  return (
    <Screen edges={['bottom']}>
      <Text color="textMuted">
        Quedarás como administrador. Después podrás invitar al resto con un código de 8 letras.
      </Text>
      <TextField label="Nombre del hogar" value={name} onChangeText={setName} placeholder="Ej: Casa Muñoz" maxLength={100} onSubmitEditing={submit} autoFocus />
      {error && (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label="Crear hogar" size="lg" block disabled={!valid} loading={pending} onPress={submit} />
    </Screen>
  );
}
