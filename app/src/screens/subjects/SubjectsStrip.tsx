import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Badge, Card, IconCircle, Text, type BadgeTone } from '../../components';
import type { RoutineWithCheck } from '../../services/api';
import type { PetView, VehicleView } from '../../services/types';
import { useTheme } from '../../theme';
import { PetAvatar, RoutinePill, keyDateBadge, urgentKeyDate } from './subjectUi';

type Toggle = { isChecked: (r: RoutineWithCheck) => boolean; toggle: (r: RoutineWithCheck) => void };

type SubjectsStripProps = {
  pets?: PetView[];
  vehicles?: VehicleView[];
  routines: RoutineWithCheck[];
  toggle: Toggle;
  onOpenPet?: (p: PetView) => void;
  onOpenVehicle?: (v: VehicleView) => void;
};

/**
 * Inicio: una tarjeta por mascota o por vehículo con su estado de hoy. Las rutinas de hoy se marcan con un toque
 * desde aquí mismo, y abajo aparece lo que viene pronto (vacuna, antiparasitario, revisión técnica).
 * Mascotas y autos van en franjas separadas: los datos son parecidos, pero una mascota es de la familia.
 */
export function SubjectsStrip({ pets = [], vehicles = [], routines, toggle, onOpenPet, onOpenVehicle }: SubjectsStripProps) {
  const t = useTheme();
  const dueFor = (match: (r: RoutineWithCheck) => boolean) => routines.filter((r) => r.status === 'active' && r.dueToday && match(r));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -t.spacing.lg, flexGrow: 0 }}
      contentContainerStyle={{ gap: t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xs }}
    >
      {pets.map((p) => {
        const due = dueFor((r) => r.petId === p.id);
        const missing = due.filter((r) => !toggle.isChecked(r));
        const urgent = urgentKeyDate(p.keyDates);
        const b = urgent && keyDateBadge(urgent);
        return (
          <SubjectCard
            key={`p${p.id}`}
            avatar={<PetAvatar species={p.species} done={due.length > 0 ? missing.length === 0 : undefined} />}
            name={p.name}
            status={due.length === 0 ? 'Nada para hoy' : missing.length === 0 ? '¡Todo listo hoy!' : `Falta: ${missing.map((r) => r.name).join(', ')}`}
            due={due}
            toggle={toggle}
            alert={urgent && b ? { label: `${urgent.title} · ${b.label}`, tone: b.tone } : undefined}
            onOpen={() => onOpenPet?.(p)}
          />
        );
      })}
      {vehicles.map((v) => {
        const due = dueFor((r) => r.vehicleId === v.id);
        const missing = due.filter((r) => !toggle.isChecked(r));
        const urgentDate = urgentKeyDate(v.keyDates);
        const urgentDoc = v.documents.filter((d) => d.status !== 'ok').sort((a, b) => a.daysLeft - b.daysLeft)[0];
        // Lo que vence antes: un papel (permiso, SOAP) o una fecha clave (mantención).
        const alert =
          urgentDoc && (!urgentDate || urgentDoc.daysLeft <= (urgentDate.daysLeft ?? 0))
            ? {
                label: `${urgentDoc.name} · ${urgentDoc.status === 'overdue' ? 'Atrasado' : urgentDoc.daysLeft === 0 ? 'Hoy' : `En ${urgentDoc.daysLeft} d`}`,
                tone: (urgentDoc.status === 'overdue' ? 'danger' : 'warning') as BadgeTone,
              }
            : urgentDate
              ? { label: `${urgentDate.title} · ${keyDateBadge(urgentDate)?.label ?? ''}`, tone: keyDateBadge(urgentDate)?.tone ?? 'warning' }
              : undefined;
        return (
          <SubjectCard
            key={`v${v.id}`}
            avatar={<IconCircle name="car-sport-outline" tone="primary" />}
            name={v.name}
            status={due.length === 0 ? (alert ? 'Tiene algo pendiente' : 'Todo al día') : missing.length === 0 ? '¡Listo esta vez!' : `Falta: ${missing.map((r) => r.name).join(', ')}`}
            due={due}
            toggle={toggle}
            alert={alert}
            onOpen={() => onOpenVehicle?.(v)}
          />
        );
      })}
    </ScrollView>
  );
}

type SubjectCardProps = {
  avatar: ReactNode;
  name: string;
  status: string;
  due: RoutineWithCheck[];
  toggle: Toggle;
  alert?: { label: string; tone: BadgeTone };
  onOpen: () => void;
};

function SubjectCard({ avatar, name, status, due, toggle, alert, onOpen }: SubjectCardProps) {
  const t = useTheme();
  return (
    <Card padding="md" style={{ width: 232 }}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${name}: ${status}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, opacity: pressed ? 0.7 : 1 })}
      >
        {avatar}
        <View style={{ flex: 1, gap: t.spacing.xxs }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {status}
          </Text>
        </View>
      </Pressable>
      {due.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
          {due.map((r) => (
            <RoutinePill key={r.id} routine={r} checked={toggle.isChecked(r)} onToggle={() => toggle.toggle(r)} />
          ))}
        </View>
      )}
      {alert && <Badge label={alert.label} tone={alert.tone} dot />}
    </Card>
  );
}
