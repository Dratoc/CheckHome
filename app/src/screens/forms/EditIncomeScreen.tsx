import { useEffect, useState } from 'react';
import { Button, LoadingState, Screen, Text, TextField } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';
import { parseUserDate, toUserDate } from '../../utils/dates';
import { parseClp, showClp } from './money';

/** Corrige o borra un pago de ingreso ya anotado. Solo quien lo anotó puede cambiarlo. */
export function EditIncomeScreen({ navigation, route }: RootScreenProps<'EditIncome'>) {
  const { incomeId } = route.params;
  const { user } = useHousehold();
  const income = useQuery(() => api.getIncome(incomeId), [incomeId]);
  const save = useMutation(api.updateIncome);
  const remove = useMutation(api.deleteIncome);
  const [raw, setRaw] = useState('');
  const [date, setDate] = useState('');
  const [filled, setFilled] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const i = income.data;
  useEffect(() => {
    if (!i || filled) return;
    setRaw(String(i.amount));
    setDate(toUserDate(i.receivedOn));
    setFilled(true);
  }, [i, filled]);

  const amount = parseClp(raw);
  const receivedOn = parseUserDate(date);
  const mine = i?.userId === user.id;

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0 || !receivedOn) return;
    if (await save.run(incomeId, amount, receivedOn)) navigation.goBack();
  };

  const onDelete = async () => {
    if (!(await confirmDanger('¿Eliminar este ingreso?', 'Se descuenta del balance del mes y no se puede recuperar.'))) return;
    if (await remove.run(incomeId)) navigation.goBack();
  };

  if (!filled || !i) {
    return <Screen edges={['bottom']}>{income.error ? <Text color="danger">{income.error}</Text> : <LoadingState />}</Screen>;
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading">{i.sourceName}</Text>
      {!mine && (
        <Text variant="caption" color="textMuted">
          Solo quien anotó este ingreso puede cambiarlo.
        </Text>
      )}
      <TextField label="Monto recibido" prefix="$" value={showClp(amount)} onChangeText={setRaw} keyboardType="number-pad" placeholder="0" error={submitted && amount <= 0 ? 'Escribe cuánto llegó.' : undefined} />
      <TextField label="Fecha" value={date} onChangeText={setDate} placeholder="dd-mm-aaaa" keyboardType="numbers-and-punctuation" error={submitted && !receivedOn ? 'Escribe la fecha como 15-12-2026.' : undefined} />
      <Text variant="caption" color="textMuted">
        {i.isPrivate ? 'Este ingreso es privado: solo tú lo ves.' : 'Este ingreso lo ve todo el hogar.'}
      </Text>
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      {mine && (
        <>
          <Button label="Guardar cambios" size="lg" block loading={save.pending} onPress={submit} />
          <Button label="Eliminar ingreso" variant="ghost" block loading={remove.pending} onPress={onDelete} />
        </>
      )}
    </Screen>
  );
}
