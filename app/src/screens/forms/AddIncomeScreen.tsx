import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { parseUserDate, toUserDate, today } from '../../utils/dates';
import { parseClp, showClp } from './money';

const addIncome = (sourceId: number, amount: number, receivedOn: string) => api.addIncome(sourceId, amount, receivedOn).then(() => true);

/** Anota un pago recibido de una fuente de ingreso, en pesos. */
export function AddIncomeScreen({ navigation, route }: RootScreenProps<'AddIncome'>) {
  const { sourceId, name, expectedAmount, isPrivate } = route.params;
  const save = useMutation(addIncome);
  const [raw, setRaw] = useState(expectedAmount ? String(expectedAmount) : '');
  const [date, setDate] = useState(toUserDate(today()));
  const [submitted, setSubmitted] = useState(false);

  const amount = parseClp(raw);
  const receivedOn = parseUserDate(date);

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0 || !receivedOn) return;
    if (await save.run(sourceId, amount, receivedOn)) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading">{name}</Text>
      <TextField label="Monto recibido" prefix="$" value={showClp(amount)} onChangeText={setRaw} keyboardType="number-pad" placeholder="0" error={submitted && amount <= 0 ? 'Escribe cuánto llegó.' : undefined} autoFocus />
      <TextField label="Fecha" value={date} onChangeText={setDate} placeholder="dd-mm-aaaa" keyboardType="numbers-and-punctuation" error={submitted && !receivedOn ? 'Escribe la fecha como 15-12-2026.' : undefined} />
      <Text variant="caption" color="textMuted">
        {isPrivate ? 'Este ingreso es privado: solo tú lo ves.' : 'Este ingreso lo ve todo el hogar.'}
      </Text>
      {save.error && (
        <Text color="danger" accessibilityRole="alert">
          {save.error}
        </Text>
      )}
      <Button label="Anotar ingreso" size="lg" block loading={save.pending} onPress={submit} />
    </Screen>
  );
}
