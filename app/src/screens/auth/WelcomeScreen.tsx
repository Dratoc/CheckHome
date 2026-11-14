import { View } from 'react-native';
import { Button, Card, Screen, Text } from '../../components';
import type { RootScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme';

export function WelcomeScreen({ navigation }: RootScreenProps<'Welcome'>) {
  const t = useTheme();
  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <View style={{ gap: t.spacing.md, marginTop: t.spacing.xxxl }}>
        <Text variant="overline" color="primary">
          CheckHome
        </Text>
        <Text variant="display" style={{ fontVariant: undefined }}>
          La casa en orden, entre todos.
        </Text>
        <Text color="textMuted">
          Anota lo que entra y lo que sale, no se te pasa ningún vencimiento y las tareas se reparten de forma justa.
        </Text>
      </View>

      <View style={{ gap: t.spacing.md }}>
        <Button label="Crear cuenta" size="lg" block onPress={() => navigation.navigate('Register')} />
        <Button label="Ya tengo cuenta" variant="secondary" size="lg" block onPress={() => navigation.navigate('Login')} />
        <Card tone="tinted" padding="md">
          <Text variant="caption" color="textMuted">
            Versión de prueba con datos simulados. Para ver un hogar con datos usa demo@checkhome.cl y la clave
            checkhome.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
