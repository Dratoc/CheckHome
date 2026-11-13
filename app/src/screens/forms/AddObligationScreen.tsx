import { useState } from 'react';
import { Button, ChoiceChips, Screen, SegmentedControl, Text, TextField, type Choice } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { ObligationKind } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { parseUserDate } from '../../utils/dates';
import { obligationIcon } from '../tabs/obligationUi';
import { parseClp, parseDecimal, showClp } from './money';

const KINDS: Choice<ObligationKind>[] = [
  { value: 'utility', label: 'Servicio', icon: obligationIcon.utility },
  { value: 'subscription', label: 'Suscripción', icon: obligationIcon.subscription },
  { value: 'mortgage', label: 'Dividendo', icon: obligationIcon.mortgage },
  { value: 'loan', label: 'Crédito', icon: obligationIcon.loan },
  { value: 'vehicle_doc', label: 'Papeles del auto', icon: obligationIcon.vehicle_doc },
  { value: 'other', label: 'Otro', icon: obligationIcon.other },
];

const PLACEHOLDER: Record<ObligationKind, string> = {
  utility: 'Ej: Luz',
  subscription: 'Ej: Internet',
  mortgage: 'Ej: Dividendo casa',
  loan: 'Ej: Crédito auto',
  vehicle_doc: 'Ej: Permiso de circulación',
  other: 'Ej: Gastos comunes',
};

/** Nueva cuenta por pagar: servicios, suscripciones, dividendo, créditos y papeles del auto. */
export function AddObligationScreen({ navigation }: RootScreenProps<'AddObligation'>) {
  const { household } = useHousehold();
  const save = useMutation(api.createObligation);
  const [kind, setKind] = useState<ObligationKind>();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<'CLP' | 'UF'>('CLP');
  const [rawAmount, setRawAmount] = useState('');
  const [due, setDue] = useState('');
  const [every, setEvery] = useState<'1' | '12'>('1');
  const [account, setAccount] = useState('');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const pickKind = (k: ObligationKind) => {
    setKind(k);
    setEvery(k === 'vehicle_doc' ? '12' : '1');
    if (k !== 'mortgage' && k !== 'loan') setCurrency('CLP');
  };

  const amount = currency === 'UF' ? parseDecimal(rawAmount) : parseClp(rawAmount);
  const nextDueOn = parseUserDate(due);
  const installmentsTotal = kind === 'loan' && total ? Number(total) : undefined;
  const installmentsPaid = installmentsTotal ? Number(paid) || 0 : undefined;

  const errors = {
    kind: !kind ? 'Elige el tipo de cuenta.' : undefined,
    name: name.trim().length < 2 ? 'Ponle un nombre.' : undefined,
    amount: amount <= 0 ? 'Escribe el monto.' : undefined,
    due: !nextDueOn ? 'Escribe la fecha como 15-12-2026.' : undefined,
    paid: installmentsTotal && (installmentsPaid ?? 0) > installmentsTotal ? 'No puede ser mayor que el total.' : undefined,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || !kind || !nextDueOn) return;
    const o = await save.run(household.id, {
      kind,
      name: name.trim(),
      currency,
      amount,
      nextDueOn,
      everyMonths: Number(every),
      accountNumber: account.trim() || undefined,
      installmentsTotal,
      installmentsPaid,
    });
    if (o) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <ChoiceChips label="Tipo" options={KINDS} value={kind} onChange={pickKind} error={show('kind')} />
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder={kind ? PLACEHOLDER[kind] : 'Ej: Luz'} error={show('name')} maxLength={100} />
      {(kind === 'mortgage' || kind === 'loan') && (
        <SegmentedControl<'CLP' | 'UF'>
          value={currency}
          onChange={setCurrency}
          options={[
            { value: 'CLP', label: 'En pesos' },
            { value: 'UF', label: 'En UF' },
          ]}
        />
      )}
      {currency === 'UF' ? (
        <TextField label="Monto en UF" prefix="UF" value={rawAmount} onChangeText={setRawAmount} keyboardType="decimal-pad" placeholder="18,5" error={show('amount')} hint="Al pagar se calcula en pesos con la UF del día." />
      ) : (
        <TextField label="Monto" prefix="$" value={showClp(parseClp(rawAmount))} onChangeText={setRawAmount} keyboardType="number-pad" placeholder="0" error={show('amount')} />
      )}
      <TextField label="Próximo vencimiento" value={due} onChangeText={setDue} placeholder="dd-mm-aaaa" keyboardType="numbers-and-punctuation" error={show('due')} />
      <SegmentedControl<'1' | '12'>
        value={every}
        onChange={setEvery}
        options={[
          { value: '1', label: 'Todos los meses' },
          { value: '12', label: 'Una vez al año' },
        ]}
      />
      {kind === 'loan' && (
        <>
          <TextField label="Total de cuotas (opcional)" value={total} onChangeText={(v) => setTotal(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="36" />
          {total ? <TextField label="Cuotas ya pagadas" value={paid} onChangeText={(v) => setPaid(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" error={show('paid')} /> : null}
        </>
      )}
      {(kind === 'utility' || kind === 'subscription') && (
        <TextField label="Número de cliente (opcional)" value={account} onChangeText={setAccount} placeholder="Para tenerlo a mano al pagar" maxLength={50} />
      )}
      {save.error && (
        <Text color="danger" accessibilityRole="alert">
          {save.error}
        </Text>
      )}
      <Button label="Guardar cuenta" size="lg" block loading={save.pending} onPress={submit} />
    </Screen>
  );
}
