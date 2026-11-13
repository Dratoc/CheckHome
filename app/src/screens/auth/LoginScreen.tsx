import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../state/SessionProvider';

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const { login } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { run, pending, error } = useMutation(login);
  const canSubmit = identifier.trim().length > 0 && password.length > 0;
  const submit = () => canSubmit && run(identifier, password);

  return (
    <Screen edges={['bottom']}>
      <TextField label="Correo o usuario" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" />
      <TextField label="Clave" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={submit} />
      {error && (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label="Ingresar" size="lg" block loading={pending} disabled={!canSubmit} onPress={submit} />
      <Button label="Crear una cuenta nueva" variant="ghost" block onPress={() => navigation.replace('Register')} />
    </Screen>
  );
}
