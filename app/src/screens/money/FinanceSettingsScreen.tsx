import { useEffect, useState } from 'react';
import { Button, LoadingState, Screen, SegmentedControl, Text, TextField } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { parseClp, parseDecimal, showClp } from '../forms/money';

type ShareMode = 'income' | 'manual';

/** Ajustes del mes del hogar: día de corte, meta de ahorro en común y cómo se calcula el % de cada uno. */
export function FinanceSettingsScreen({ navigation }: RootScreenProps<'FinanceSettings'>) {
  const { household } = useHousehold();
  const current = useQuery(() => api.getFinanceSettings(household.id), [household.id]);
  const save = useMutation((input: api.FinanceSettingsInput) => api.updateFinanceSettings(household.id, input));
  const [cut, setCut] = useState('');
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<ShareMode>('income');
  const [pcts, setPcts] = useState<Record<number, string>>({});
  const [filled, setFilled] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const s = current.data;
  useEffect(() => {
    if (!s || filled) return;
    setCut(s.cycleCutDay ? String(s.cycleCutDay) : '');
    setGoal(s.savingsGoal ? String(s.savingsGoal) : '');
    setMode(s.shareSource === 'manual' ? 'manual' : 'income');
    setPcts(Object.fromEntries(s.members.map((m) => [m.userId, String(m.share).replace('.', ',')])));
    setFilled(true);
  }, [s, filled]);

  if (!s || !filled) {
    return <Screen edges={['bottom']}>{current.error ? <Text color="danger">{current.error}</Text> : <LoadingState />}</Screen>;
  }

  const cutDay = cut ? Number(cut) : null;
  const savingsGoal = parseClp(goal);
  const shares = s.members.map((m) => ({ userId: m.userId, pct: parseDecimal(pcts[m.userId] ?? '0') }));
  const total = shares.reduce((sum, x) => sum + x.pct, 0);
  const errors = {
    cut: cutDay != null && !(cutDay >= 1 && cutDay <= 31) ? 'Un día entre 1 y 31, o vacío para usar el mes calendario.' : undefined,
    shares: mode === 'manual' && Math.abs(total - 100) > 0.5 ? `Los porcentajes suman ${total.toLocaleString('es-CL')}; deben sumar 100.` : undefined,
  };

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const saved = await save.run({ cycleCutDay: cutDay, savingsGoal, shares: mode === 'manual' ? shares : null });
    if (saved) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Día de corte del mes del hogar"
        value={cut}
        onChangeText={(v) => setCut(v.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        placeholder="Vacío = mes calendario"
        error={submitted ? errors.cut : undefined}
        hint="Usa el mismo corte de la tarjeta: así el mes de la app calza con lo que se paga el día de vencimiento."
      />
      <TextField label="Meta de ahorro en común al mes" prefix="$" value={showClp(savingsGoal)} onChangeText={setGoal} keyboardType="number-pad" placeholder="0" hint="Se reparte con el mismo % del hogar." />

      <Text variant="label">% de cada uno</Text>
      <SegmentedControl<ShareMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'income', label: 'Según sueldos' },
          { value: 'manual', label: 'Fijo' },
        ]}
      />
      {mode === 'income' ? (
        <Text variant="caption" color="textMuted">
          {s.shareSource === 'equal'
            ? 'Nadie ha registrado su sueldo en Cuentas › Ingresos, así que por ahora es en partes iguales.'
            : `Con los sueldos registrados (los privados cuentan, pero solo se muestra el %): ${s.members.map((m) => `${m.name.split(' ')[0]} ${m.share.toLocaleString('es-CL')}%`).join(', ')}.`}
        </Text>
      ) : (
        s.members.map((m) => (
          <TextField
            key={m.userId}
            label={m.name}
            value={pcts[m.userId] ?? ''}
            onChangeText={(v) => setPcts((p) => ({ ...p, [m.userId]: v.replace(/[^\d,.]/g, '') }))}
            keyboardType="decimal-pad"
            placeholder="50"
          />
        ))
      )}
      {submitted && errors.shares && <Text color="danger">{errors.shares}</Text>}
      {save.error && (
        <Text color="danger" accessibilityRole="alert">
          {save.error}
        </Text>
      )}
      <Button label="Guardar ajustes" size="lg" block loading={save.pending} onPress={submit} />
    </Screen>
  );
}
