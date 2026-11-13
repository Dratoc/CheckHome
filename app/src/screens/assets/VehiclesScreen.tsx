import { View } from 'react-native';
import { Badge, Button, Card, EmptyState, IconCircle, ListItem, QueryView, Screen, Text } from '../../components';
import { useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { VehicleView } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { formatShortDate } from '../../utils/dates';
import { obligationBadge } from '../tabs/obligationUi';

/** Vehículos del hogar y sus papeles: permiso de circulación, revisión técnica, SOAP y seguro. */
export function VehiclesScreen({ navigation }: RootScreenProps<'Vehicles'>) {
  const { household } = useHousehold();
  const query = useQuery(() => api.listVehicles(household.id), [household.id]);
  const add = () => navigation.navigate('AddVehicle');

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
            {rows.map((v) => (
              <VehicleCard
                key={v.id}
                v={v}
                onEdit={() => navigation.navigate('AddVehicle', { vehicle: v })}
                onOpenDoc={(id, name) => navigation.navigate('ObligationDetail', { obligationId: id, name })}
                onAddDoc={() => navigation.navigate('AddObligation', { kind: 'vehicle_doc', vehicleId: v.id })}
              />
            ))}
            <Button label="Agregar vehículo" variant="secondary" block onPress={add} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function VehicleCard({ v, onEdit, onOpenDoc, onAddDoc }: { v: VehicleView; onEdit: () => void; onOpenDoc: (id: number, name: string) => void; onAddDoc: () => void }) {
  const t = useTheme();
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
        return (
          <ListItem
            key={d.id}
            title={d.name}
            subtitle={`Vence ${formatShortDate(d.nextDueOn)} ${d.nextDueOn.slice(0, 4)}`}
            trailing={<Badge label={b.label} tone={b.tone} dot />}
            onPress={() => onOpenDoc(d.id, d.name)}
            divider
          />
        );
      })}
      {v.documents.length === 0 && (
        <Text variant="caption" color="textMuted">
          Sin papeles todavía: permiso de circulación, revisión técnica, SOAP, seguro.
        </Text>
      )}
      <View style={{ alignItems: 'flex-start', marginTop: t.spacing.xs }}>
        <Button label="Agregar papel" size="sm" variant="ghost" onPress={onAddDoc} />
      </View>
    </Card>
  );
}
