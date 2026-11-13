import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { Avatar, Badge, Button, Card, EmptyState, ListItem, QueryView, Screen, SectionHeader, Text } from '../../components';
import { useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useSession } from '../../state/SessionProvider';
import { useTheme } from '../../theme';

/** "Salas": elige en qué hogar entrar, o crea / únete a uno nuevo. */
export function ChooseHouseholdScreen({ navigation }: RootScreenProps<'ChooseHousehold'>) {
  const t = useTheme();
  const { user, selectHousehold, logout } = useSession();
  const query = useQuery(() => api.listMyHouseholds(user!.id), [user]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ gap: t.spacing.xxs }}>
        <Text variant="overline" color="textMuted">
          Hola, {user?.displayName.split(' ')[0]}
        </Text>
        <Text variant="title" accessibilityRole="header">
          Elige tu hogar
        </Text>
      </View>

      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyState
              title="Aún no estás en ningún hogar"
              message="Crea uno para tu familia o únete con el código de invitación que te compartieron."
            />
          </Card>
        }
      >
        {(households) => (
          <Card padding="md">
            {households.map((h, i) => (
              <ListItem
                key={h.id}
                title={h.name}
                subtitle={`${h.memberCount} ${h.memberCount === 1 ? 'miembro' : 'miembros'}`}
                leading={<Avatar name={h.name} />}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                    {h.role === 'admin' && <Badge label="Admin" tone="primary" />}
                    <Ionicons name="chevron-forward" size={18} color={t.colors.textSubtle} />
                  </View>
                }
                divider={i < households.length - 1}
                onPress={() => selectHousehold(h)}
              />
            ))}
          </Card>
        )}
      </QueryView>

      <SectionHeader title="Otro hogar" />
      <Button label="Crear un hogar" block onPress={() => navigation.navigate('CreateHousehold')} />
      <Button label="Unirme con un código" variant="secondary" block onPress={() => navigation.navigate('JoinHousehold')} />
      <Button label="Cerrar sesión" variant="ghost" block onPress={logout} />
    </Screen>
  );
}
