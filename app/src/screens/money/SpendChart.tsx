import { View } from 'react-native';
import { Amount, Text, formatCLP } from '../../components';
import type { SpendGroup } from '../../services/types';
import { chartColors, useTheme } from '../../theme';

type Series = { key: string; name: string; color: string };

const first = (name: string) => name.split(' ')[0];
/** "Casa" o "Hernán (personal)" */
export const groupLabel = (g: SpendGroup) => (g.userId ? `${first(g.name)} (personal)` : g.name);
const keyOf = (methodId: number | null) => (methodId == null ? 'none' : String(methodId));

/**
 * Colores por medio de pago: orden fijo por id del medio (el color sigue al medio, no a su ranking).
 * Con más medios que colores, los que sobran se juntan en "Otros". "Sin indicar" va en gris.
 */
function seriesOf(rows: SpendGroup[], palette: readonly string[], none: string) {
  const byId = new Map<number, string>();
  let hasNone = false;
  for (const m of rows) for (const x of m.methods) x.methodId == null ? (hasNone = true) : byId.set(x.methodId, x.name);
  const ids = [...byId.keys()].sort((a, b) => a - b);
  const keep = ids.length > palette.length ? palette.length - 1 : ids.length;
  const series = new Map<string, Series>();
  ids.forEach((id, i) => {
    if (i < keep) series.set(String(id), { key: String(id), name: byId.get(id)!, color: palette[i] });
    else series.set(String(id), { key: 'other', name: 'Otros', color: palette[palette.length - 1] });
  });
  if (hasNone) series.set('none', { key: 'none', name: 'Sin indicar', color: none });
  return series;
}

/**
 * Gráfico del mes: cuánto se gastó con cada medio de pago y, para la casa y lo personal de cada uno, cómo se reparte entre medios.
 * Los montos exactos van escritos al lado de cada barra y en la lista "Quién gastó con qué".
 */
export function SpendChart({ rows }: { rows: SpendGroup[] }) {
  const t = useTheme();
  const pal = chartColors[t.scheme];
  const series = seriesOf(rows, pal.series, pal.none);
  const seriesFor = (methodId: number | null) => series.get(keyOf(methodId))!;

  // Totales por medio (sumando a todos), en el orden de las series.
  const totals = new Map<string, { s: Series; amount: number }>();
  for (const m of rows)
    for (const x of m.methods) {
      const s = seriesFor(x.methodId);
      const cur = totals.get(s.key) ?? { s, amount: 0 };
      cur.amount += x.amount;
      totals.set(s.key, cur);
    }
  const byMethod = [...totals.values()].sort((a, b) => b.amount - a.amount);
  const maxMethod = Math.max(1, ...byMethod.map((x) => x.amount));
  const maxMember = Math.max(1, ...rows.map((m) => m.total));

  if (byMethod.length === 0) {
    return (
      <Text variant="caption" color="textMuted">
        Todavía no hay gastos anotados este mes.
      </Text>
    );
  }

  return (
    <View style={{ gap: t.spacing.md }}>
      <Text variant="label" color="textMuted">
        Por medio de pago
      </Text>
      {byMethod.map(({ s, amount }) => (
        <View key={s.key} style={{ gap: t.spacing.xs }} accessible accessibilityLabel={`${s.name}: ${formatCLP(amount)}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body">{s.name}</Text>
            <Amount value={amount} />
          </View>
          <Bar segments={[{ key: s.key, color: s.color, amount }]} max={maxMethod} />
        </View>
      ))}

      <Text variant="label" color="textMuted">
        La casa y lo personal de cada uno
      </Text>
      {rows.map((m) => {
        // Segmentos de la persona, en el mismo orden fijo de las series.
        const segs = new Map<string, { key: string; color: string; amount: number }>();
        for (const x of m.methods) {
          const s = seriesFor(x.methodId);
          const cur = segs.get(s.key) ?? { key: s.key, color: s.color, amount: 0 };
          cur.amount += x.amount;
          segs.set(s.key, cur);
        }
        const order = [...series.values()].map((s) => s.key);
        const list = [...segs.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
        const detail = list.map((x) => `${[...series.values()].find((s) => s.key === x.key)!.name} ${formatCLP(x.amount)}`).join(', ');
        return (
          <View key={m.key} style={{ gap: t.spacing.xs }} accessible accessibilityLabel={`${groupLabel(m)}: ${formatCLP(m.total)}. ${detail}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body">{groupLabel(m)}</Text>
              <Amount value={m.total} />
            </View>
            <Bar segments={list} max={maxMember} />
          </View>
        );
      })}

      <Legend series={[...new Map([...series.values()].map((s) => [s.key, s])).values()]} />
    </View>
  );
}

/** Barra horizontal: segmentos con 2px de separación y extremos redondeados; el largo es proporcional al máximo. */
function Bar({ segments, max }: { segments: { key: string; color: string; amount: number }[]; max: number }) {
  const t = useTheme();
  const total = segments.reduce((s, x) => s + x.amount, 0);
  return (
    <View style={{ height: 12, borderRadius: 4, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${(total / max) * 100}%`, height: '100%', flexDirection: 'row', gap: 2 }}>
        {segments
          .filter((x) => x.amount > 0)
          .map((x) => (
            <View key={x.key} style={{ flex: x.amount, backgroundColor: x.color, borderRadius: 4 }} />
          ))}
      </View>
    </View>
  );
}

function Legend({ series }: { series: Series[] }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
      {series.map((s) => (
        <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
          <Text variant="caption" color="textMuted">
            {s.name}
          </Text>
        </View>
      ))}
    </View>
  );
}
