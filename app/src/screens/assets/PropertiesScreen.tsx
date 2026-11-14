import { useState } from 'react';
import { View } from 'react-native';
import { Amount, Badge, Button, Card, EmptyState, IconCircle, ListItem, QueryView, Screen, Text, formatCLP } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Attachment, IncomeSource, ObligationView, PropertyView } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { monthName, today } from '../../utils/dates';
import { obligationBadge } from '../tabs/obligationUi';
import { AttachmentRows } from './attachmentUi';

/** Propiedades: dividendo pagado (UF o pesos) y arriendo recibido, con el neto del mes. */
export function PropertiesScreen({ navigation }: RootScreenProps<'Properties'>) {
  const { household } = useHousehold();
  const query = useQuery(() => api.listProperties(household.id), [household.id]);
  const open = useMutation(api.openAttachment);
  const [opening, setOpening] = useState<number>();
  const add = () => navigation.navigate('AddProperty');
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
            <EmptyState title="Sin propiedades" message="Agrega tu casa o las que arriendas para ver el dividendo y el arriendo de cada una." action="Agregar propiedad" onAction={add} />
          </Card>
        }
      >
        {(rows) => (
          <>
            {open.error && (
              <Text color="danger" accessibilityRole="alert">
                {open.error}
              </Text>
            )}
            {rows.map((p) => (
              <PropertyCard
                key={p.id}
                p={p}
                onEdit={() => navigation.navigate('AddProperty', { property: p })}
                onOpenMortgage={(o) => navigation.navigate('ObligationDetail', { obligationId: o.id, name: o.name })}
                onAddMortgage={() => navigation.navigate('AddObligation', { kind: 'mortgage', propertyId: p.id })}
                onReceiveRent={(s) => navigation.navigate('AddIncome', { source: s })}
                onAddRent={() => navigation.navigate('AddIncomeSource', { propertyId: p.id })}
                opening={opening}
                onOpenFile={openFile}
                onEditFile={(a) => navigation.navigate('AddAttachment', { attachment: a })}
                onAttach={() => navigation.navigate('AddAttachment', { owner: 'property', propertyId: p.id })}
              />
            ))}
            <Button label="Agregar propiedad" variant="secondary" block onPress={add} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

type CardProps = {
  p: PropertyView;
  onEdit: () => void;
  onOpenMortgage: (o: ObligationView) => void;
  onAddMortgage: () => void;
  onReceiveRent: (s: IncomeSource) => void;
  onAddRent: () => void;
  opening?: number;
  onOpenFile: (a: Attachment) => void;
  onEditFile: (a: Attachment) => void;
  onAttach: () => void;
};

function PropertyCard({ p, onEdit, onOpenMortgage, onAddMortgage, onReceiveRent, onAddRent, opening, onOpenFile, onEditFile, onAttach }: CardProps) {
  const t = useTheme();
  const net = p.rentThisMonth - p.mortgagePaidThisMonth;
  const hasMoney = p.mortgages.length > 0 || p.rentSources.length > 0;
  return (
    <Card padding="md">
      <ListItem
        title={p.name}
        subtitle={p.address ?? 'Toca para agregar la dirección'}
        leading={<IconCircle name="home-outline" tone="primary" />}
        trailing={<Text variant="label" color="primary">Editar</Text>}
        onPress={onEdit}
        divider
      />

      {p.mortgages.map((o) => {
        const b = obligationBadge(o);
        return (
          <ListItem
            key={o.id}
            title={o.name}
            subtitle={o.currency === 'UF' ? `UF ${o.amount.toLocaleString('es-CL')} · ${b.label}` : b.label}
            leading={<IconCircle name="arrow-up" tone={o.status === 'overdue' ? 'danger' : 'neutral'} />}
            trailing={<Amount value={o.amountClp} sign="expense" />}
            onPress={() => onOpenMortgage(o)}
            divider
          />
        );
      })}
      {p.rentSources.map((s) => (
        <ListItem
          key={s.id}
          title={s.name}
          subtitle={`Llega el día ${s.payDay} · Toca para anotar el pago`}
          leading={<IconCircle name="arrow-down" tone="primary" />}
          trailing={<Amount value={s.expectedAmount} sign="income" />}
          onPress={() => onReceiveRent(s)}
          divider
        />
      ))}

      <AttachmentRows items={p.attachments} onOpen={onOpenFile} onEdit={onEditFile} opening={opening} />

      {hasMoney && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            En {monthName(today())}: arriendo recibido menos dividendo pagado
          </Text>
          <Badge label={`${net >= 0 ? '+' : '−'}${formatCLP(Math.abs(net)).replace(/\s/g, '')}`} tone={net >= 0 ? 'success' : 'warning'} />
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
        <Button label="Agregar dividendo" size="sm" variant="ghost" onPress={onAddMortgage} />
        <Button label="Agregar arriendo" size="sm" variant="ghost" onPress={onAddRent} />
        <Button label="Adjuntar documento" size="sm" variant="ghost" onPress={onAttach} />
      </View>
    </Card>
  );
}
