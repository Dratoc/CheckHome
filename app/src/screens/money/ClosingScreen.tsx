import { useState } from 'react';
import { View } from 'react-native';
import { Amount, Badge, Button, Card, IconCircle, ListItem, ProgressBar, QueryView, Screen, SectionHeader, Text, formatCLP } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { ClosingMember, MonthClosing, Transfer } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { confirmDanger } from '../../utils/confirm';
import { formatShortDate } from '../../utils/dates';

const first = (name: string) => name.split(' ')[0];

const SHARE_SOURCE: Record<MonthClosing['shareSource'], string> = {
  manual: 'según los % fijados en Ajustes del reparto',
  income: 'según el sueldo registrado de cada uno',
  equal: 'en partes iguales (nadie ha registrado su sueldo)',
};

/**
 * Cierre del mes del hogar (del día después del corte hasta el corte): cuánto se gastó en el hogar y en lo
 * personal, cuánto le tocaba a cada uno según su %, cuánto puso de verdad y quién le transfiere a quién.
 */
export function ClosingScreen({ navigation, route }: RootScreenProps<'Closing'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const [end, setEnd] = useState(route.params?.end);
  const query = useQuery(() => api.getClosing(household.id, end), [household.id, end]);
  const close = useMutation(async (cycleEnd: string) => {
    await api.closeMonth(household.id, cycleEnd);
    await query.reload();
  });
  const reopen = useMutation(async (cycleEnd: string) => {
    await api.reopenMonth(household.id, cycleEnd);
    await query.reload();
  });

  const onClose = async (c: MonthClosing) => {
    const what = c.transfers.length ? c.transfers.map(transferText).join('. ') : 'Están a mano.';
    const warn = c.isFinal ? '' : ' Ojo: todavía falta pagar la tarjeta o depositar el ahorro, así que estos montos pueden cambiar.';
    if (await confirmDanger('¿Marcar transferido y cerrar el mes?', `${what}.${warn}`, 'Cerrar mes')) await close.run(c.cycle.end);
  };

  const onReopen = async (c: MonthClosing) => {
    if (await confirmDanger('¿Reabrir este mes?', 'Se borra el registro del cierre. Los gastos y pagos no cambian.', 'Reabrir')) await reopen.run(c.cycle.end);
  };

  return (
    <Screen edges={['bottom']}>
      <QueryView query={query}>
        {(c) => (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
              <Button label="‹ Anterior" size="sm" variant="ghost" onPress={() => setEnd(c.prevEnd)} />
              <Text variant="label">{c.cycle.label}</Text>
              <Button label="Siguiente ›" size="sm" variant="ghost" onPress={() => setEnd(c.nextEnd)} />
            </View>

            <Settlement c={c} closing={close.pending} reopening={reopen.pending} onClose={() => onClose(c)} onReopen={() => onReopen(c)} />
            {(close.error || reopen.error) && (
              <Text color="danger" accessibilityRole="alert">
                {close.error ?? reopen.error}
              </Text>
            )}

            <Card padding="md">
              <Row label="Gastos del hogar" value={c.totals.household} />
              <Row label="Gastos personales" value={c.totals.personal} />
              <Row label="Ahorro depositado" value={c.totals.savingsDeposited} hint={c.totals.savingsGoal ? `de ${formatCLP(c.totals.savingsGoal)}` : undefined} />
              <Row label="Pagado con tarjeta de crédito" value={c.totals.byCredit} muted />
              <Text variant="caption" color="textMuted">
                El hogar y la meta de ahorro se reparten {SHARE_SOURCE[c.shareSource]}. Lo personal lo paga cada uno.
              </Text>
            </Card>

            <SectionHeader title="Cada uno" action="Ajustes" onAction={() => navigation.navigate('FinanceSettings')} />
            {c.members.map((m) => (
              <MemberCard key={m.userId} m={m} />
            ))}

            {c.cards.length > 0 && (
              <>
                <SectionHeader title="Tarjetas de crédito" />
                <Card padding="md">
                  {c.cards.map((s, i) => (
                    <ListItem
                      key={s.methodId}
                      title={s.name}
                      subtitle={s.pending > 0 ? `Faltan ${formatCLP(s.pending)} · vence ${formatShortDate(s.dueOn)}` : s.charged > 0 ? 'Pagada' : 'Sin cargos'}
                      leading={<IconCircle name="card-outline" tone={s.pending > 0 ? 'warning' : 'primary'} />}
                      trailing={<Amount value={s.charged} />}
                      onPress={() => navigation.navigate('CardStatement', { methodId: s.methodId, name: s.name, end: s.end })}
                      divider={i < c.cards.length - 1}
                    />
                  ))}
                </Card>
              </>
            )}

            <SectionHeader title="Ahorro en común" />
            <Card padding="md">
              <Row label="Acumulado" value={c.totals.savingsTotal} />
              {c.totals.savingsGoal > 0 && (
                <ProgressBar
                  value={Math.min(1, c.totals.savingsDeposited / c.totals.savingsGoal)}
                  accessibilityLabel={`${formatCLP(c.totals.savingsDeposited)} de ${formatCLP(c.totals.savingsGoal)} este mes`}
                />
              )}
              <Text variant="caption" color="textMuted">
                {c.totals.savingsGoal > 0
                  ? `Este mes: ${formatCLP(c.totals.savingsDeposited)} de la meta de ${formatCLP(c.totals.savingsGoal)}. Cada depósito cuenta como aporte de quien lo hizo.`
                  : 'Fija una meta mensual en Ajustes y se reparte con el mismo % del hogar.'}
              </Text>
              <Button label="Anotar depósito" size="sm" variant="secondary" onPress={() => navigation.navigate('AddSavings')} />
            </Card>

            <Button label="Medios de pago" variant="ghost" block onPress={() => navigation.navigate('PaymentMethods')} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const transferText = (x: Transfer) => `${first(x.fromName)} le transfiere ${formatCLP(x.amount)} a ${first(x.toName)}`;

function Settlement({ c, closing, reopening, onClose, onReopen }: { c: MonthClosing; closing: boolean; reopening: boolean; onClose: () => void; onReopen: () => void }) {
  const t = useTheme();
  if (c.closed) {
    return (
      <Card tone="tinted">
        <Badge label="Mes cerrado" tone="success" dot />
        {c.closed.transfers.length ? (
          c.closed.transfers.map((x) => (
            <Text key={`${x.fromUserId}-${x.toUserId}`} variant="heading">
              {first(x.fromName)} le transfirió {formatCLP(x.amount)} a {first(x.toName)}
            </Text>
          ))
        ) : (
          <Text variant="heading">Quedaron a mano</Text>
        )}
        <Text variant="caption" color="textMuted">
          Cerrado por {first(c.closed.closedBy)} el {formatShortDate(c.closed.closedAt.slice(0, 10))}.
        </Text>
        <Button label="Reabrir mes" size="sm" variant="ghost" loading={reopening} onPress={onReopen} />
      </Card>
    );
  }
  const pending = [
    c.pendingCard > 0 ? `pagar ${formatCLP(c.pendingCard)} de la tarjeta (se supone que la paga su dueño)` : null,
    c.savingsShortfall > 0 ? `depositar ${formatCLP(c.savingsShortfall)} al ahorro` : null,
  ].filter(Boolean);
  return (
    <Card tone="tinted">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.sm }}>
        <Text variant="label" color="textMuted">
          Saldo del mes
        </Text>
        <Badge label={c.cycle.isCurrent ? 'En curso' : c.cycle.hasEnded ? 'Falta cerrar' : 'Próximo'} tone={c.cycle.hasEnded ? 'warning' : 'neutral'} dot />
      </View>
      {c.transfers.length ? (
        c.transfers.map((x) => (
          <Text key={`${x.fromUserId}-${x.toUserId}`} variant="heading">
            {transferText(x)}
          </Text>
        ))
      ) : (
        <Text variant="heading">Están a mano</Text>
      )}
      {pending.length > 0 && (
        <Text variant="caption" color="textMuted">
          Provisorio: falta {pending.join(' y ')}.
        </Text>
      )}
      {c.cycle.hasEnded ? (
        <Button label="Marcar transferido y cerrar el mes" block loading={closing} onPress={onClose} />
      ) : (
        <Text variant="caption" color="textMuted">
          Este mes del hogar termina el {formatShortDate(c.cycle.end)}; después de esa fecha se puede cerrar.
        </Text>
      )}
    </Card>
  );
}

function MemberCard({ m }: { m: ClosingMember }) {
  return (
    <Card padding="md">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading">{first(m.name)}</Text>
        <Badge label={`${m.sharePct.toLocaleString('es-CL')}%`} tone="primary" />
      </View>
      <Text variant="label" color="textMuted">
        Le toca
      </Text>
      <Row label="Su parte del hogar" value={m.expectedHousehold} />
      {m.expectedSavings > 0 && <Row label="Su parte del ahorro" value={m.expectedSavings} />}
      {m.personal > 0 && <Row label="Sus gastos personales" value={m.personal} />}
      <Row label="Total" value={m.expected} strong />
      <Text variant="label" color="textMuted">
        Puso
      </Text>
      {m.paidExpenses > 0 && <Row label="Con débito o efectivo" value={m.paidExpenses} />}
      {m.paidCard > 0 && <Row label="Pagos de la tarjeta" value={m.paidCard} />}
      {m.paidSavings > 0 && <Row label="Depósitos al ahorro" value={m.paidSavings} />}
      {m.cardToPay > 0 && <Row label="Tarjeta por pagar (provisorio)" value={m.cardToPay} muted />}
      <Row label="Total" value={m.paidTotal + m.cardToPay} strong />
      <Badge
        label={Math.abs(m.balance) < 1 ? 'A mano' : m.balance > 0 ? `Puso ${formatCLP(m.balance)} de más` : `Le faltan ${formatCLP(-m.balance)}`}
        tone={Math.abs(m.balance) < 1 ? 'success' : m.balance > 0 ? 'primary' : 'warning'}
      />
    </Card>
  );
}

function Row({ label, value, hint, strong, muted }: { label: string; value: number; hint?: string; strong?: boolean; muted?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.sm }}>
      <Text variant={strong ? 'label' : 'body'} color={muted ? 'textMuted' : 'text'} style={{ flex: 1 }}>
        {label}
        {hint ? ` (${hint})` : ''}
      </Text>
      <Amount value={value} />
    </View>
  );
}
