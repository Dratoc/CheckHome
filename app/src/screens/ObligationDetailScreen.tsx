import { useState } from 'react';
import { View } from 'react-native';
import { Amount, Badge, Button, Card, EmptyState, IconCircle, ListItem, ProgressBar, QueryView, Screen, SectionHeader, Text } from '../components';
import { useMutation, useQuery } from '../hooks/useQuery';
import type { RootScreenProps } from '../navigation/types';
import * as api from '../services/api';
import type { Attachment, ObligationPayment, ObligationView } from '../services/types';
import { useHousehold } from '../state/SessionProvider';
import { useTheme } from '../theme';
import { confirmDanger } from '../utils/confirm';
import { formatShortDate } from '../utils/dates';
import { AttachmentRows, kindForObligation } from './assets/attachmentUi';
import { obligationBadge, obligationIcon, obligationSubtitle } from './tabs/obligationUi';

const formatUf = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 });

/** Detalle de una cuenta por pagar: datos, historial de pagos y deshacer el último pago. */
export function ObligationDetailScreen({ navigation, route }: RootScreenProps<'ObligationDetail'>) {
  const t = useTheme();
  const { obligationId } = route.params;
  const obligation = useQuery(() => api.getObligation(obligationId), [obligationId]);
  const payments = useQuery(() => api.listObligationPayments(obligationId), [obligationId]);
  const { household } = useHousehold();
  const files = useQuery(() => api.listAttachments(household.id).then((all) => all.filter((a) => a.obligationId === obligationId)), [household.id, obligationId]);
  const open = useMutation(api.openAttachment);
  const [opening, setOpening] = useState<number>();
  const openFile = async (a: Attachment) => {
    setOpening(a.id);
    await open.run(a.id);
    setOpening(undefined);
  };
  const reloadAll = async () => {
    await Promise.all([obligation.reload(), payments.reload()]);
  };
  const pay = useMutation(async () => {
    await api.payObligation(obligationId);
    await reloadAll();
  });
  const undo = useMutation(async (p: ObligationPayment) => {
    await api.undoObligationPayment(p.id);
    await reloadAll();
  });

  const onUndo = async (p: ObligationPayment) => {
    const ok = await confirmDanger('¿Deshacer este pago?', `Se borra el pago del ${formatShortDate(p.paidOn)} y el vencimiento vuelve a la fecha anterior.`, 'Deshacer');
    if (ok) await undo.run(p);
  };

  return (
    <Screen edges={['bottom']}>
      <QueryView query={obligation}>
        {(o) => <Summary o={o} paying={pay.pending} onPay={() => pay.run()} onEdit={() => navigation.navigate('AddObligation', { obligationId })} />}
      </QueryView>
      {(pay.error || undo.error || open.error) && (
        <Text color="danger" accessibilityRole="alert">
          {pay.error ?? undo.error ?? open.error}
        </Text>
      )}

      {obligation.data && (obligation.data.vehicleId || obligation.data.propertyId) ? (
        <>
          <SectionHeader title="Documento" />
          <Card padding="md">
            <QueryView
              query={files}
              isEmpty={(d) => d.length === 0}
              empty={<EmptyState title="Sin copia digital" message="Adjunta el PDF oficial o una foto para tenerlo siempre a mano." />}
            >
              {(rows) => <AttachmentRows items={rows} onOpen={openFile} onEdit={(a) => navigation.navigate('AddAttachment', { attachment: a })} opening={opening} />}
            </QueryView>
            <View style={{ alignItems: 'flex-start' }}>
              <Button
                label={files.data?.length ? 'Adjuntar otro' : 'Adjuntar copia digital'}
                size="sm"
                variant="ghost"
                onPress={() => {
                  const o = obligation.data!;
                  navigation.navigate('AddAttachment', {
                    owner: o.vehicleId ? 'vehicle' : 'property',
                    obligationId: o.id,
                    kind: kindForObligation(o),
                    title: o.name,
                    expiresOn: o.nextDueOn,
                  });
                }}
              />
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Historial de pagos" />
      <Card padding="md">
        <QueryView
          query={payments}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="Sin pagos todavía" message="Cada vez que marques esta cuenta como pagada, queda anotado aquí." />}
        >
          {(rows) =>
            rows.map((p, i) => (
              <View key={p.id} style={{ gap: t.spacing.xs }}>
                <ListItem
                  title={formatShortDate(p.paidOn) + ' ' + p.paidOn.slice(0, 4)}
                  subtitle={`Pagó ${p.paidBy.split(' ')[0]}${p.ufValue ? ` · UF del día $${formatUf(p.ufValue)}` : ''}`}
                  leading={<IconCircle name="receipt-outline" tone="neutral" />}
                  trailing={<Amount value={p.amountClp} />}
                  divider={i < rows.length - 1 && !p.canUndo}
                />
                {p.canUndo && (
                  <Button label="Deshacer este pago" size="sm" variant="ghost" loading={undo.pending} onPress={() => onUndo(p)} />
                )}
              </View>
            ))
          }
        </QueryView>
      </Card>
    </Screen>
  );
}

function Summary({ o, paying, onPay, onEdit }: { o: ObligationView; paying: boolean; onPay: () => void; onEdit: () => void }) {
  const t = useTheme();
  const b = obligationBadge(o);
  return (
    <Card padding="md">
      <ListItem
        title={o.name}
        subtitle={obligationSubtitle(o)}
        leading={<IconCircle name={obligationIcon[o.kind]} tone={o.status === 'overdue' ? 'danger' : o.status === 'due_soon' ? 'warning' : 'primary'} />}
        trailing={<Amount value={o.amountClp} />}
      />
      {o.installmentsTotal ? (
        <View style={{ gap: t.spacing.xs }}>
          <Text variant="caption" color="textMuted">
            {o.installmentsPaid ?? 0} de {o.installmentsTotal} cuotas pagadas
          </Text>
          <ProgressBar value={(o.installmentsPaid ?? 0) / o.installmentsTotal} accessibilityLabel={`${o.installmentsPaid} de ${o.installmentsTotal} cuotas pagadas`} />
        </View>
      ) : null}
      {o.accountNumber && (
        <Text variant="caption" color="textMuted" selectable>
          N° de cliente: {o.accountNumber}
        </Text>
      )}
      {o.currency === 'UF' && (
        <Text variant="caption" color="textMuted">
          UF {formatUf(o.amount)} al mes; en pesos se calcula con la UF del día.
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
        <Badge label={b.label} tone={b.tone} dot />
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Button label="Editar" size="sm" variant="ghost" onPress={onEdit} />
          <Button label="Marcar pagado" size="sm" variant="secondary" loading={paying} onPress={onPay} />
        </View>
      </View>
    </Card>
  );
}
