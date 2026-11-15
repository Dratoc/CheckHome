import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, EmptyState, IconCircle, ListItem, QueryView, Screen, Text } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { RoutineWithCheck } from '../../services/api';
import type { Attachment, KeyDate, ObligationView, VehicleView } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { formatShortDate } from '../../utils/dates';
import { obligationBadge } from '../tabs/obligationUi';
import { repeatLabel } from '../../utils/weekdays';
import { KeyDateRows } from '../subjects/subjectUi';
import { AttachmentRows, kindForObligation } from './attachmentUi';

/**
 * Vehículos del hogar: sus papeles con costo (permiso de circulación, revisión técnica, SOAP, seguro), sus documentos
 * digitales, sus fechas clave sin costo (mantención, cambio de aceite) y sus rutinas (lavarlo, revisar neumáticos).
 */
export function VehiclesScreen({ navigation }: RootScreenProps<'Vehicles'>) {
  const { household } = useHousehold();
  const query = useQuery(() => api.listVehicles(household.id), [household.id]);
  const routines = useQuery(() => api.listRoutines(household.id), [household.id]);
  const open = useMutation(api.openAttachment);
  const done = useMutation(async (k: KeyDate) => {
    await api.markKeyDateDone(k.id);
    await query.reload();
  });
  const [busy, setBusy] = useState<number>();
  const markDone = async (k: KeyDate) => {
    setBusy(k.id);
    await done.run(k);
    setBusy(undefined);
  };
  const [opening, setOpening] = useState<number>();
  const add = () => navigation.navigate('AddVehicle');
  const openFile = async (a: Attachment) => {
    setOpening(a.id);
    await open.run(a.id);
    setOpening(undefined);
  };

  return (
    <Screen edges={['bottom']}>
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyState title="Sin vehículos" message="Agrega cada auto y anota sus papeles para no olvidar ningún vencimiento." action="Agregar vehículo" onAction={add} />
          </Card>
        }
      >
        {(rows) => (
          <>
            {(open.error || done.error) && (
              <Text color="danger" accessibilityRole="alert">
                {open.error ?? done.error}
              </Text>
            )}
            {rows.map((v) => (
              <VehicleCard
                key={v.id}
                v={v}
                onEdit={() => navigation.navigate('AddVehicle', { vehicle: v })}
                onOpenDoc={(id, name) => navigation.navigate('ObligationDetail', { obligationId: id, name })}
                onAddDoc={() => navigation.navigate('AddObligation', { kind: 'vehicle_doc', vehicleId: v.id })}
                opening={opening}
                onOpenFile={openFile}
                onEditFile={(a) => navigation.navigate('AddAttachment', { attachment: a })}
                onAttach={() => navigation.navigate('AddAttachment', { owner: 'vehicle', vehicleId: v.id })}
                onAttachToDoc={(d) =>
                  navigation.navigate('AddAttachment', { owner: 'vehicle', obligationId: d.id, kind: kindForObligation(d), title: d.name, expiresOn: d.nextDueOn })
                }
                routines={(routines.data ?? []).filter((r) => r.vehicleId === v.id)}
                onOpenRoutine={(r) => navigation.navigate('AddRoutine', { routine: r })}
                onAddRoutine={() => navigation.navigate('AddRoutine', { vehicleId: v.id })}
                busyDate={busy}
                onDoneDate={markDone}
                onEditDate={(k) => navigation.navigate('AddKeyDate', { keyDate: k })}
                onAddDate={() => navigation.navigate('AddKeyDate', { vehicleId: v.id })}
              />
            ))}
            <Button label="Agregar vehículo" variant="secondary" block onPress={add} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

type CardProps = {
  v: VehicleView;
  onEdit: () => void;
  onOpenDoc: (id: number, name: string) => void;
  onAddDoc: () => void;
  opening?: number;
  onOpenFile: (a: Attachment) => void;
  onEditFile: (a: Attachment) => void;
  onAttach: () => void;
  onAttachToDoc: (d: ObligationView) => void;
  routines: RoutineWithCheck[];
  onOpenRoutine: (r: RoutineWithCheck) => void;
  onAddRoutine: () => void;
  busyDate?: number;
  onDoneDate: (k: KeyDate) => void;
  onEditDate: (k: KeyDate) => void;
  onAddDate: () => void;
};

function VehicleCard(props: CardProps) {
  const { v, onEdit, onOpenDoc, onAddDoc, opening, onOpenFile, onEditFile, onAttach, onAttachToDoc } = props;
  const t = useTheme();
  // Papel con su copia digital: tocar abre el archivo directo (lo que se muestra en un control).
  const fileOf = (d: ObligationView) => v.attachments.find((a) => a.obligationId === d.id);
  const details = [v.plate, v.model, v.year].filter(Boolean).join(' · ');
  return (
    <Card padding="md">
      <ListItem
        title={v.name}
        subtitle={details || 'Toca para agregar patente y modelo'}
        leading={<IconCircle name="car-sport-outline" tone="primary" />}
        trailing={<Text variant="label" color="primary">Editar</Text>}
        onPress={onEdit}
        divider={v.documents.length > 0}
      />
      {v.documents.map((d) => {
        const b = obligationBadge(d);
        const file = fileOf(d);
        return (
          <View key={d.id}>
            <ListItem
              title={d.name}
              subtitle={`Vence ${formatShortDate(d.nextDueOn)} ${d.nextDueOn.slice(0, 4)}${file ? ' · Con documento' : ''}`}
              trailing={<Badge label={b.label} tone={b.tone} dot />}
              onPress={() => onOpenDoc(d.id, d.name)}
              divider={!!file}
            />
            {file ? (
              <AttachmentRows items={[file]} onOpen={onOpenFile} onEdit={onEditFile} opening={opening} compact />
            ) : (
              <View style={{ alignItems: 'flex-start', borderBottomWidth: t.sizes.borderWidth, borderBottomColor: t.colors.border, paddingBottom: t.spacing.xs }}>
                <Button label="Adjuntar copia digital" size="sm" variant="ghost" onPress={() => onAttachToDoc(d)} />
              </View>
            )}
          </View>
        );
      })}
      <AttachmentRows items={v.attachments.filter((a) => !v.documents.some((d) => d.id === a.obligationId))} onOpen={onOpenFile} onEdit={onEditFile} opening={opening} />
      {v.documents.length === 0 && (
        <Text variant="caption" color="textMuted">
          Sin papeles todavía: permiso de circulación, revisión técnica, SOAP, seguro. Para lo que no se paga (mantención,
          cambio de aceite) usa una fecha clave.
        </Text>
      )}
      <KeyDateRows items={v.keyDates} busy={props.busyDate} onDone={props.onDoneDate} onEdit={props.onEditDate} />
      {props.routines.map((r) => (
        <ListItem
          key={`r${r.id}`}
          title={r.name}
          subtitle={r.status === 'estimating' ? 'Rutina en votación' : `Rutina · ${repeatLabel(r)}`}
          trailing={r.status === 'active' ? <Badge label={`+${r.points ?? 0}`} tone="points" /> : <Badge label="Por valorar" tone="neutral" />}
          onPress={() => props.onOpenRoutine(r)}
          divider
        />
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, marginTop: t.spacing.xs }}>
        <Button label="Agregar papel" size="sm" variant="ghost" onPress={onAddDoc} />
        <Button label="Fecha clave" size="sm" variant="ghost" onPress={props.onAddDate} />
        <Button label="Rutina" size="sm" variant="ghost" onPress={props.onAddRoutine} />
        <Button label="Adjuntar documento" size="sm" variant="ghost" onPress={onAttach} />
      </View>
    </Card>
  );
}
