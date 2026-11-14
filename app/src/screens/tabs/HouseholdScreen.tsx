import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, View } from 'react-native';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ListItem,
  QueryView,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
} from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { TabScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold, useSession } from '../../state/SessionProvider';
import { useTheme, type ColorSchemePreference } from '../../theme';

/** Hogar: miembros, código de invitación, cambiar de hogar y preferencias. */
export function HouseholdScreen({ navigation }: TabScreenProps<'Household'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const { selectHousehold, leaveCurrentHousehold, logout } = useSession();
  const members = useQuery(() => api.listMembers(household.id), [household.id]);
  const regenerate = useMutation(api.regenerateInviteCode);
  const [copied, setCopied] = useState(false);
  const code = household.inviteCode;
  const pretty = `${code.slice(0, 4)} ${code.slice(4)}`;

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = () =>
    Share.share({ message: `Únete a ${household.name} en CheckHome con el código ${code}` }).catch(() => undefined);

  const newCode = async () => {
    const c = await regenerate.run(household.id, user.id);
    if (c) selectHousehold({ ...household, inviteCode: c });
  };

  return (
    <Screen edges={['top']}>
      <View style={{ gap: t.spacing.xxs }}>
        <Text variant="overline" color="textMuted">
          Hogar
        </Text>
        <Text variant="title" accessibilityRole="header">
          {household.name}
        </Text>
      </View>

      <Card tone="tinted">
        <Text variant="label" color="textMuted">
          Código de invitación
        </Text>
        <Text variant="display" accessibilityLabel={`Código ${code.split('').join(' ')}`} selectable>
          {pretty}
        </Text>
        <Text variant="caption" color="textMuted">
          Quien tenga este código puede unirse al hogar. Compártelo solo con tu familia.
        </Text>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
          <Button label={copied ? 'Copiado' : 'Copiar'} size="sm" onPress={copy} />
          <Button label="Compartir" size="sm" variant="secondary" onPress={share} />
          {household.role === 'admin' && <Button label="Cambiar código" size="sm" variant="ghost" loading={regenerate.pending} onPress={newCode} />}
        </View>
        {regenerate.error && <Text color="danger">{regenerate.error}</Text>}
      </Card>

      <SectionHeader title="Miembros" />
      <Card padding="md">
        <QueryView query={members}>
          {(rows) =>
            rows.map((m, i) => (
              <ListItem
                key={m.id}
                title={m.id === user.id ? `${m.displayName} (tú)` : m.displayName}
                subtitle={`@${m.username}`}
                leading={<Avatar name={m.displayName} />}
                trailing={m.role === 'admin' ? <Badge label="Admin" tone="primary" /> : undefined}
                divider={i < rows.length - 1}
              />
            ))
          }
        </QueryView>
      </Card>

      <SectionHeader title="Apariencia" />
      <SegmentedControl<ColorSchemePreference>
        value={t.preference}
        onChange={t.setPreference}
        options={[
          { value: 'system', label: 'Automático' },
          { value: 'light', label: 'Claro' },
          { value: 'dark', label: 'Oscuro' },
        ]}
      />

      <SectionHeader title="Cuenta" />
      <Button label="Cambiar de hogar" variant="secondary" block onPress={leaveCurrentHousehold} />
      <Button label="Ver sistema de diseño" variant="ghost" block onPress={() => navigation.navigate('DesignPreview')} />
      <Button label="Cerrar sesión" variant="ghost" block onPress={logout} />
      <Text variant="caption" color="textSubtle" align="center">
        Sesión de {user.email}
      </Text>
    </Screen>
  );
}
