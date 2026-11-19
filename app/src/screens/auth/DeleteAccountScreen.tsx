import { useState } from 'react';
import { Button, Card, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useSession } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';

/**
 * Eliminar la cuenta desde la app (requisito de Google Play). Pide la clave y una confirmación final.
 * Al terminar cierra la sesión y la app vuelve a la bienvenida.
 */
export function DeleteAccountScreen({ navigation }: RootScreenProps<'DeleteAccount'>) {
  const { user, logout } = useSession();
  const [password, setPassword] = useState('');
  const { run, pending, error } = useMutation(api.deleteAccount);

  const submit = async () => {
    if (!password) return;
    const ok = await confirmDanger(
      '¿Eliminar tu cuenta?',
      'Esto no se puede deshacer. Se borran tus datos y los hogares donde eras el único miembro.',
      'Eliminar cuenta',
    );
    if (!ok) return;
    // Al cerrar la sesión el navegador cambia solo a la bienvenida.
    if (await run(password)) logout();
  };

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Text variant="bodyStrong">Qué pasa al eliminar tu cuenta</Text>
        <Text color="textMuted">
          • Se borran tu correo, tu nombre de usuario, tu nombre y tu clave.{'\n'}
          • Los hogares donde eras el único miembro se borran completos, con todos sus datos y documentos.{'\n'}
          • En los hogares que compartes, sales del hogar y se borran tus ingresos privados y tus votos. Los gastos y pagos
          que anotaste para el hogar quedan a nombre de «Cuenta eliminada», para que las cuentas del resto no cambien.{'\n'}
          • No se puede deshacer.
        </Text>
      </Card>
      <TextField
        label={`Clave de ${user?.username ?? 'tu cuenta'}`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      {error && (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label="Eliminar mi cuenta" variant="danger" size="lg" block loading={pending} disabled={!password} onPress={submit} />
      <Button label="Cancelar" variant="ghost" block onPress={() => navigation.goBack()} />
    </Screen>
  );
}
