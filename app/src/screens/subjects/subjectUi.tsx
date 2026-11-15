import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { Badge, Button, ListItem, Text, type BadgeTone } from '../../components';
import type { RoutineWithCheck } from '../../services/api';
import type { KeyDate, Pet, PetSpecies } from '../../services/types';
import { useTheme } from '../../theme';
import { speciesEmoji } from '../../utils/categories';
import { formatShortDate } from '../../utils/dates';

/** Avatar de una mascota: su emoji en un círculo. El anillo es verde si ya se hizo todo lo de hoy. */
export function PetAvatar({ species, size = 'md', done }: { species: PetSpecies; size?: 'md' | 'lg'; done?: boolean }) {
  const t = useTheme();
  const px = size === 'lg' ? 72 : t.sizes.avatarLg;
  const ring = done === undefined ? t.colors.border : done ? t.colors.success : t.colors.points;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: px,
        height: px,
        borderRadius: px / 2,
        borderWidth: 3,
        borderColor: ring,
        backgroundColor: t.colors.pointsSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: px * 0.5, lineHeight: px * 0.62 }}>{speciesEmoji(species)}</Text>
      {done && (
        <View
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: t.colors.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={14} color={t.colors.surface} />
        </View>
      )}
    </View>
  );
}

/** Edad en palabras: "3 años", "8 meses". */
export function petAge(p: Pet) {
  if (!p.birthDate) return undefined;
  const [y, m, d] = p.birthDate.split('-').map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) - (now.getDate() < d ? 1 : 0);
  if (months < 0) months = 0;
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

export function keyDateBadge(k: KeyDate): { label: string; tone: BadgeTone } | undefined {
  if (k.status === 'overdue') return { label: 'Atrasada', tone: 'danger' };
  if (k.status === 'due_soon') return { label: k.daysLeft === 0 ? 'Hoy' : k.daysLeft === 1 ? 'Mañana' : `En ${k.daysLeft} d`, tone: 'warning' };
  if (k.status === 'ok') return { label: 'Al día', tone: 'success' };
  return undefined;
}

/** "25 nov" este año; "25 nov 2025" otro año. */
const shortDate = (iso: string) => (iso.slice(0, 4) === String(new Date().getFullYear()) ? formatShortDate(iso) : `${formatShortDate(iso)} ${iso.slice(0, 4)}`);

function keyDateSubtitle(k: KeyDate) {
  const parts = [];
  if (k.lastOn) parts.push(`Última: ${shortDate(k.lastOn)}`);
  if (k.nextOn) parts.push(`Próxima: ${shortDate(k.nextOn)}`);
  if (!k.nextOn) parts.push('Sin próxima');
  return parts.join(' · ');
}

/** Lo más urgente: la fecha atrasada o la más cercana que viene pronto. */
export function urgentKeyDate(dates: KeyDate[]) {
  return dates.filter((k) => k.status === 'overdue' || k.status === 'due_soon').sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
}

type KeyDateRowsProps = {
  items: KeyDate[];
  onEdit: (k: KeyDate) => void;
  onDone: (k: KeyDate) => void;
  /** Id de la fecha que se está marcando */
  busy?: number;
};

/** Filas de fechas clave: tocar edita; "Hecho hoy" deja la última vez en hoy con un toque. */
export function KeyDateRows({ items, onEdit, onDone, busy }: KeyDateRowsProps) {
  const t = useTheme();
  return (
    <>
      {items.map((k) => {
        const b = keyDateBadge(k);
        return (
          <View key={k.id} style={{ borderBottomWidth: t.sizes.borderWidth, borderBottomColor: t.colors.border, paddingBottom: t.spacing.xs }}>
            <ListItem
              title={k.title}
              subtitle={keyDateSubtitle(k)}
              trailing={b && <Badge label={b.label} tone={b.tone} dot />}
              onPress={() => onEdit(k)}
            />
            {(k.status === 'overdue' || k.status === 'due_soon') && (
              <View style={{ alignItems: 'flex-start' }}>
                <Button label="Hecho hoy" size="sm" variant="secondary" loading={busy === k.id} onPress={() => onDone(k)} />
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

/**
 * Píldora de una rutina de hoy: un toque la marca hecha (o la deshace). Es lo que hace que el avatar no mienta:
 * si marcar costara más de un toque, la gente dejaría de hacerlo.
 */
export function RoutinePill({ routine, checked, onToggle }: { routine: RoutineWithCheck; checked: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={routine.name}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        minHeight: t.sizes.buttonSm,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.pill,
        backgroundColor: checked ? t.colors.successSoft : t.colors.surface,
        borderWidth: t.sizes.borderWidth,
        borderColor: checked ? t.colors.successSoft : t.colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={checked ? t.colors.success : t.colors.textMuted} />
      <Text variant="label" color={checked ? 'success' : 'text'} numberOfLines={1}>
        {routine.name}
      </Text>
    </Pressable>
  );
}
