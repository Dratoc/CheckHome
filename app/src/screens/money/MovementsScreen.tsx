import { useState } from 'react';
import { View } from 'react-native';
import { Amount, Badge, Button, Card, ChoiceChips, EmptyState, QueryView, Screen, Text, TextField } from '../../components';
import { useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { Movement } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { MovementRow, useOpenMovement } from './movementUi';

type Kind = 'all' | Movement['kind'];

const KINDS: { value: Kind; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'expense', label: 'Gastos' },
  { value: 'payment', label: 'Cuentas pagadas' },
  { value: 'income', label: 'Ingresos' },
];

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Historial completo de movimientos, un mes del hogar a la vez (el mismo ciclo del cierre del mes). Se filtra por
 * tipo y se busca por texto (descripción, categoría, medio de pago o quién lo anotó). Los filtros se mantienen al
 * cambiar de mes.
 */
export function MovementsScreen({ route }: RootScreenProps<'Movements'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const [end, setEnd] = useState(route.params?.end);
  const [kind, setKind] = useState<Kind>('all');
  const [search, setSearch] = useState('');
  const query = useQuery(() => api.getMonthMovements(household.id, end), [household.id, end]);
  const open = useOpenMovement();

  return (
    <Screen edges={['bottom']}>
      <QueryView query={query}>
        {(s) => {
          const q = normalize(search.trim());
          const rows = s.rows.filter((m) => (kind === 'all' || m.kind === kind) && (!q || normalize(`${m.title} ${m.subtitle}`).includes(q)));
          const filtered = kind !== 'all' || q.length > 0;
          const shownTotal = rows.reduce((sum, m) => sum + (m.kind === 'income' ? m.amount : -m.amount), 0);
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
                <Button label="‹ Anterior" size="sm" variant="ghost" onPress={() => setEnd(s.prevEnd)} />
                <Text variant="label">{s.label}</Text>
                <Button label="Siguiente ›" size="sm" variant="ghost" onPress={() => setEnd(s.nextEnd)} />
              </View>

              <Card tone="tinted">
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="label" color="textMuted">
                    Resumen del mes
                  </Text>
                  {s.isCurrent && <Badge label="Mes en curso" tone="neutral" dot />}
                </View>
                <View style={{ flexDirection: 'row', gap: t.spacing.lg, flexWrap: 'wrap' }}>
                  <Text variant="caption" color="textMuted">
                    Entró <Amount value={s.totals.income} sign="income" variant="caption" />
                  </Text>
                  <Text variant="caption" color="textMuted">
                    Gastos <Amount value={s.totals.expense} variant="caption" />
                  </Text>
                  <Text variant="caption" color="textMuted">
                    Cuentas pagadas <Amount value={s.totals.payment} variant="caption" />
                  </Text>
                </View>
              </Card>

              <ChoiceChips label="Mostrar" options={KINDS} value={kind} onChange={setKind} />
              <TextField label="Buscar" value={search} onChangeText={setSearch} placeholder="Ej: supermercado, luz, Cami" returnKeyType="search" />

              {filtered && rows.length > 0 && (
                <Text variant="caption" color="textMuted">
                  {rows.length === 1 ? '1 movimiento' : `${rows.length} movimientos`} · Total{' '}
                  <Amount value={Math.abs(shownTotal)} sign={shownTotal < 0 ? 'expense' : 'income'} variant="caption" />
                </Text>
              )}

              <Card padding="md">
                {rows.length === 0 ? (
                  <EmptyState
                    title={filtered ? 'Nada con ese filtro' : 'Sin movimientos este mes'}
                    message={filtered ? 'Prueba con otra palabra o elige «Todo».' : 'Los gastos, ingresos y cuentas pagadas de este mes aparecen aquí.'}
                  />
                ) : (
                  rows.map((m, i) => <MovementRow key={m.key} m={m} onPress={() => open(m)} divider={i < rows.length - 1} />)
                )}
              </Card>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
