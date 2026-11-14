import { useState } from 'react';
import { Button, ChoiceChips, Screen, SegmentedControl, Text, TextField } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { PaymentMethodKind } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';

const save = (householdId: number, methodId: number | undefined, input: api.PaymentMethodInput) =>
  methodId ? api.updatePaymentMethod(methodId, input) : api.createPaymentMethod(householdId, input);

const PLACEHOLDER: Record<PaymentMethodKind, string> = { credit: 'Ej: Visa Hernán', debit: 'Ej: Débito Cami', cash: 'Ej: Efectivo' };

const dayOrUndefined = (v: string) => {
  const n = Number(v);
  return n >= 1 && n <= 31 ? n : undefined;
};

/** Nuevo medio de pago. Con method, lo edita (el tipo no cambia). */
export function AddPaymentMethodScreen({ navigation, route }: RootScreenProps<'AddPaymentMethod'>) {
  const { user, household } = useHousehold();
  const method = route.params?.method;
  const members = useQuery(() => api.listMembers(household.id), [household.id]);
  const saving = useMutation(save);
  const remove = useMutation(api.deletePaymentMethod);
  const [kind, setKind] = useState<PaymentMethodKind>(method?.kind ?? 'credit');
  const [name, setName] = useState(method?.name ?? '');
  const [ownerId, setOwnerId] = useState(method?.ownerUserId ?? user.id);
  const [cut, setCut] = useState(method?.cutDay ? String(method.cutDay) : '');
  const [due, setDue] = useState(method?.dueDay ? String(method.dueDay) : '');
  const [submitted, setSubmitted] = useState(false);

  const cutDay = dayOrUndefined(cut);
  const dueDay = dayOrUndefined(due);
  const errors = {
    name: name.trim().length < 2 ? 'Ponle un nombre.' : undefined,
    cut: kind === 'credit' && !cutDay ? 'Un día entre 1 y 31.' : undefined,
    due: kind === 'credit' && !dueDay ? 'Un día entre 1 y 31.' : undefined,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const ok = await saving.run(household.id, method?.id, { kind, name: name.trim(), ownerUserId: ownerId, cutDay: kind === 'credit' ? cutDay : undefined, dueDay: kind === 'credit' ? dueDay : undefined });
    if (ok) navigation.goBack();
  };

  const onDelete = async () => {
    if (!method) return;
    const ok = await confirmDanger(`¿Quitar ${method.name}?`, 'Si ya tiene gastos anotados, queda archivado: los gastos siguen diciendo con qué se pagaron.', 'Quitar');
    if (ok && (await remove.run(method.id))) navigation.navigate('PaymentMethods');
  };

  return (
    <Screen edges={['bottom']}>
      {!method && (
        <SegmentedControl<PaymentMethodKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'credit', label: 'Crédito' },
            { value: 'debit', label: 'Débito' },
            { value: 'cash', label: 'Efectivo' },
          ]}
        />
      )}
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder={PLACEHOLDER[kind]} error={show('name')} maxLength={100} autoFocus={!method} />
      {(members.data?.length ?? 0) > 1 && (
        <ChoiceChips<number>
          label={kind === 'credit' ? '¿De quién es la tarjeta?' : '¿De quién es?'}
          options={(members.data ?? []).map((m) => ({ value: m.id, label: m.displayName.split(' ')[0] }))}
          value={ownerId}
          onChange={setOwnerId}
        />
      )}
      {kind === 'credit' && (
        <>
          <TextField label="Día de corte (facturación)" value={cut} onChangeText={(v) => setCut(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="19" error={show('cut')} hint="Lo que compras hasta este día entra en el estado de cuenta de ese mes." />
          <TextField label="Día de vencimiento (pago)" value={due} onChangeText={(v) => setDue(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="5" error={show('due')} />
        </>
      )}
      <Text variant="caption" color="textMuted">
        {kind === 'credit'
          ? 'Los gastos con tarjeta no cuentan como aporte de nadie hasta que alguien paga la tarjeta: ese pago es el aporte.'
          : 'Lo que se paga con este medio cuenta como aporte de su dueño en el cierre del mes.'}
      </Text>
      {(saving.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {saving.error ?? remove.error}
        </Text>
      )}
      <Button label={method ? 'Guardar cambios' : 'Guardar medio de pago'} size="lg" block loading={saving.pending} onPress={submit} />
      {method && <Button label="Quitar medio de pago" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
