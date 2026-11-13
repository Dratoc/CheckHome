import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../state/SessionProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

type Fields = { displayName: string; username: string; email: string; password: string; confirm: string };

function validate(f: Fields): Partial<Fields> {
  const e: Partial<Fields> = {};
  if (f.displayName.trim().length < 2) e.displayName = 'Escribe tu nombre.';
  if (!USERNAME_RE.test(f.username.trim().toLowerCase())) e.username = 'De 3 a 30 letras, números, punto o guion bajo.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Revisa el correo.';
  if (f.password.length < 8) e.password = 'Usa al menos 8 caracteres.';
  if (f.confirm !== f.password) e.confirm = 'Las claves no coinciden.';
  return e;
}

export function RegisterScreen({ navigation }: RootScreenProps<'Register'>) {
  const { register } = useSession();
  const [f, setF] = useState<Fields>({ displayName: '', username: '', email: '', password: '', confirm: '' });
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(f) : {};
  const { run, pending, error } = useMutation(register);
  const set = (k: keyof Fields) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validate(f)).length > 0) return;
    run({ displayName: f.displayName, username: f.username, email: f.email, password: f.password });
  };

  return (
    <Screen edges={['bottom']}>
      <Text color="textMuted">
        Tu cuenta es tuya: con ella puedes estar en uno o varios hogares. La validación del correo llegará en una
        próxima versión.
      </Text>
      <TextField label="Nombre" value={f.displayName} onChangeText={set('displayName')} error={errors.displayName} placeholder="Como te dicen en la casa" autoComplete="name" />
      <TextField label="Nombre de usuario" value={f.username} onChangeText={set('username')} error={errors.username} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" />
      <TextField label="Correo" value={f.email} onChangeText={set('email')} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextField label="Clave" value={f.password} onChangeText={set('password')} error={errors.password} secureTextEntry autoComplete="new-password" />
      <TextField label="Repite la clave" value={f.confirm} onChangeText={set('confirm')} error={errors.confirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
      {error && (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label="Crear cuenta" size="lg" block loading={pending} onPress={submit} />
      <Button label="Ya tengo cuenta" variant="ghost" block onPress={() => navigation.replace('Login')} />
    </Screen>
  );
}
