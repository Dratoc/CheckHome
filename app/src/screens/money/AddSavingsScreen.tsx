import { useState } from 'react';
import { Amount, Button, Card, IconCircle, ListItem, QueryView, Screen, SectionHeader, Text, TextField } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { SavingsDeposit } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';
import { formatShortDate } from '../../utils/dates';
import { parseClp, showClp } from '../forms/money';

/** Anotar un depósito a la cuenta de ahorro en común; cuenta como aporte de quien deposita. */
export function AddSavingsScreen({ navigation }: RootScreenProps<'AddSavings'>) {
  const { user, household } = useHousehold();
  const savings = useQuery(() => api.getSavings(household.id), [household.id]);
  const add = useMutation(api.addSavingsDeposit);
  const remove = useMutation(async (id: number) => {
    await api.deleteSavingsDeposit(id);
    await savings.reload();
  });
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const amount = parseClp(raw);

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0) return;
    if (await add.run(household.id, amount, note.trim() || undefined)) navigation.goBack();
  };

  const onRemove = async (d: SavingsDeposit) => {
    if (await confirmDanger('¿Borrar este depósito?', `${d.depositedBy.split(' ')[0]}, ${formatShortDate(d.depositedOn)}.`, 'Borrar')) await remove.run(d.id);
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Monto depositado" prefix="$" value={showClp(amount)} onChangeText={setRaw} keyboardType="number-pad" placeholder="0" error={submitted && amount <= 0 ? 'Escribe cuánto depositaste.' : undefined} autoFocus />
      <TextField label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="Ej: Ahorro de noviembre" maxLength={200} />
      {(add.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {add.error ?? remove.error}
        </Text>
      )}
      <Button label="Anotar depósito" size="lg" block loading={add.pending} onPress={submit} />

      <QueryView query={savings}>
        {(s) =>
          s.deposits.length > 0 ? (
            <>
              <SectionHeader title="Últimos depósitos" />
              <Card padding="md">
                {s.deposits.map((d, i) => (
                  <ListItem
                    key={d.id}
                    title={d.note || `Depósito de ${d.depositedBy.split(' ')[0]}`}
                    subtitle={`${formatShortDate(d.depositedOn)} ${d.depositedOn.slice(0, 4)} · ${d.depositedBy.split(' ')[0]}${d.userId === user.id ? ' · Toca para borrar' : ''}`}
                    leading={<IconCircle name="trending-up-outline" tone="primary" />}
                    trailing={<Amount value={d.amount} />}
                    onPress={d.userId === user.id ? () => onRemove(d) : undefined}
                    divider={i < s.deposits.length - 1}
                  />
                ))}
              </Card>
            </>
          ) : null
        }
      </QueryView>
    </Screen>
  );
}
