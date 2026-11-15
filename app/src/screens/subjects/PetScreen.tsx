import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Checkbox, EmptyState, ListItem, QueryView, Screen, SectionHeader, Text } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import { useRoutineToggle } from '../../hooks/useRoutineToggle';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Attachment, KeyDate } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { SPECIES } from '../../utils/categories';
import { repeatLabel } from '../../utils/weekdays';
import { AttachmentRows } from '../assets/attachmentUi';
import { KeyDateRows, PetAvatar, petAge } from './subjectUi';

const pts = (n: number) => `${n} ${n === 1 ? 'pto' : 'pts'}`;

/** Ficha de una mascota: lo de hoy (comida, paseo), sus otras rutinas, sus fechas clave y sus documentos. */
export function PetScreen({ navigation, route }: RootScreenProps<'Pet'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const { petId } = route.params;
  const pets = useQuery(() => api.listPets(household.id), [household.id]);
  const routines = useQuery(() => api.listRoutines(household.id), [household.id]);
  const toggle = useRoutineToggle(user.id, routines.reload);
  const done = useMutation(async (k: KeyDate) => {
    await api.markKeyDateDone(k.id);
    await pets.reload();
  });
  const open = useMutation(api.openAttachment);
  const [busy, setBusy] = useState<number>();
  const [opening, setOpening] = useState<number>();

  const markDone = async (k: KeyDate) => {
    setBusy(k.id);
    await done.run(k);
    setBusy(undefined);
  };
  const openFile = async (a: Attachment) => {
    setOpening(a.id);
    await open.run(a.id);
    setOpening(undefined);
  };

  return (
    <Screen edges={['bottom']}>
      <QueryView query={pets} isEmpty={(d) => !d.some((p) => p.id === petId)} empty={<EmptyState title="No encontramos esta mascota" message="Puede que alguien de la casa la haya eliminado." />}>
        {(rows) => {
          const pet = rows.find((p) => p.id === petId)!;
          const mine = (routines.data ?? []).filter((r) => r.petId === pet.id);
          const today = mine.filter((r) => r.status === 'active' && r.dueToday);
          const other = mine.filter((r) => !(r.status === 'active' && r.dueToday));
          const doneToday = today.filter(toggle.isChecked).length;
          const details = [SPECIES.find((s) => s.value === pet.species)?.label, petAge(pet)].filter(Boolean).join(' · ');
          const addRoutine = () => navigation.navigate('AddRoutine', { petId: pet.id });
          return (
            <>
              <Card tone="points" onPress={() => navigation.navigate('AddPet', { pet })} accessibilityLabel={`Editar a ${pet.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg }}>
                  <PetAvatar species={pet.species} size="lg" done={today.length > 0 ? doneToday === today.length : undefined} />
                  <View style={{ flex: 1, gap: t.spacing.xxs }}>
                    <Text variant="heading">{pet.name}</Text>
                    {details ? (
                      <Text variant="caption" color="textMuted">
                        {details}
                      </Text>
                    ) : null}
                    <Text variant="label" color="points">
                      {today.length === 0 ? 'Nada para hoy' : doneToday === today.length ? '¡Todo listo hoy!' : `Hoy lleva ${doneToday} de ${today.length}`}
                    </Text>
                  </View>
                  <Text variant="label" color="primary">
                    Editar
                  </Text>
                </View>
              </Card>

              <SectionHeader title="Hoy" />
              <Card padding="md">
                {today.length === 0 ? (
                  <Text variant="caption" color="textMuted">
                    {mine.length === 0 ? 'Crea sus rutinas diarias (comida, agua, paseo) para marcarlas con un toque.' : 'Ninguna de sus rutinas toca hoy.'}
                  </Text>
                ) : (
                  today.map((r) => (
                    <Checkbox
                      key={r.id}
                      label={r.name}
                      hint={toggle.isChecked(r) ? 'Hecha · Toca para deshacer' : `${r.frequency === 'daily' ? 'Hoy' : 'Esta semana'} · +${pts(r.points ?? 0)}`}
                      checked={toggle.isChecked(r)}
                      onChange={() => toggle.toggle(r)}
                    />
                  ))
                )}
                {toggle.error && <Text color="danger">{toggle.error}</Text>}
                {other.map((r) => (
                  <ListItem
                    key={r.id}
                    title={r.name}
                    subtitle={r.status === 'estimating' ? 'En votación (pestaña Tareas › Rutinas)' : repeatLabel(r)}
                    trailing={r.status === 'estimating' ? <Badge label="Por valorar" tone="neutral" /> : undefined}
                    onPress={() => navigation.navigate('AddRoutine', { routine: r })}
                  />
                ))}
                <Button label="Agregar rutina" size="sm" variant="ghost" onPress={addRoutine} />
              </Card>

              <SectionHeader title="Fechas clave" />
              <Card padding="md">
                {pet.keyDates.length === 0 && (
                  <Text variant="caption" color="textMuted">
                    Anota su última vacuna, el antiparasitario o el control: te avisamos antes de la próxima.
                  </Text>
                )}
                <KeyDateRows items={pet.keyDates} busy={busy} onDone={markDone} onEdit={(k) => navigation.navigate('AddKeyDate', { keyDate: k })} />
                {done.error && <Text color="danger">{done.error}</Text>}
                <Button label="Agregar fecha" size="sm" variant="ghost" onPress={() => navigation.navigate('AddKeyDate', { petId: pet.id })} />
              </Card>

              <SectionHeader title="Documentos" />
              <Card padding="md">
                {pet.attachments.length === 0 && (
                  <Text variant="caption" color="textMuted">
                    Guarda una foto del carnet de vacunas o la ficha del veterinario.
                  </Text>
                )}
                <AttachmentRows items={pet.attachments} opening={opening} onOpen={openFile} onEdit={(a) => navigation.navigate('AddAttachment', { attachment: a })} />
                {open.error && <Text color="danger">{open.error}</Text>}
                <Button label="Adjuntar documento" size="sm" variant="ghost" onPress={() => navigation.navigate('AddAttachment', { owner: 'pet', petId: pet.id })} />
              </Card>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
