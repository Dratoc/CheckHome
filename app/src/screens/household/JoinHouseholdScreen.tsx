import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import * as api from '../../services/api';
import { useSession } from '../../state/SessionProvider';

export function JoinHouseholdScreen() {
  const { user, selectHousehold } = useSession();
  const [code, setCode] = useState('');
  const { run, pending, error } = useMutation(api.joinHousehold);
  const normalized = api.normalizeInviteCode(code);
  const valid = normalized.length === 8;

  const submit = async () => {
    if (!valid) return;
    const h = await run(user!.id, normalized);
    if (h) selectHousehold(h);
  };

  return (
    <Screen edges={['bottom']}>
      <Text color="textMuted">
        Pídele el código a alguien del hogar. Lo encuentra en la pestaña Hogar.
      </Text>
      <TextField
        label="Código de invitación"
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="K7M2QX9P"
        hint="8 letras y números"
        error={error}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={10}
        onSubmitEditing={submit}
        autoFocus
      />
      <Button label="Unirme" size="lg" block disabled={!valid} loading={pending} onPress={submit} />
      <Text variant="caption" color="textSubtle">
        Para probar: K7M2QX9P (Casa Muñoz) o VN4H8TRA (Depto Viña).
      </Text>
    </Screen>
  );
}
