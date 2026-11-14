import { useEffect, useState } from 'react';
import { Button, ChoiceChips, LoadingState, Screen, SegmentedControl, Text, TextField, type Choice } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { ObligationKind } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';
import { parseUserDate, toUserDate } from '../../utils/dates';
import { obligationIcon } from '../tabs/obligationUi';
import { parseClp, parseDecimal, showClp } from './money';
import { methodChoices } from '../money/paymentMethodUi';

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

const saveObligation = (householdId: number, obligationId: number | undefined, input: api.ObligationInput) =>
  obligationId ? api.updateObligation(obligationId, input) : api.createObligation(householdId, input);

/** Nueva cuenta por pagar: servicios, suscripciones, dividendo, créditos y papeles del auto. Con obligationId, la edita. */
export function AddObligationScreen({ navigation, route }: RootScreenProps<'AddObligation'>) {
  const { household } = useHousehold();
  const obligationId = route.params?.obligationId;
  const preset = route.params;
  const vehicles = useQuery(() => api.listVehicles(household.id), [household.id]);
  const properties = useQuery(() => api.listProperties(household.id), [household.id]);
  const methods = useQuery(() => api.listPaymentMethods(household.id), [household.id]);
  const existing = useQuery(() => (obligationId ? api.getObligation(obligationId) : Promise.resolve(undefined)), [obligationId]);
  const save = useMutation(saveObligation);
  const remove = useMutation(api.deleteObligation);
  const [kind, setKind] = useState<ObligationKind | undefined>(preset?.kind);
  // 0 = no ligada a ningún vehículo o propiedad
  const [vehicleId, setVehicleId] = useState(preset?.vehicleId ?? 0);
  const [propertyId, setPropertyId] = useState(preset?.propertyId ?? 0);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<'CLP' | 'UF'>('CLP');
  const [rawAmount, setRawAmount] = useState('');
  const [due, setDue] = useState('');
  const [every, setEvery] = useState<'1' | '12'>(preset?.kind === 'vehicle_doc' ? '12' : '1');
  const [account, setAccount] = useState('');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('');
  // 0 = sin definir
  const [methodId, setMethodId] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [filled, setFilled] = useState(false);

  // Al editar, se rellena el formulario una sola vez con la cuenta guardada.
  const o = existing.data;
  useEffect(() => {
    if (!o || filled) return;
    setKind(o.kind);
    setName(o.name);
    setCurrency(o.currency);
    setRawAmount(o.currency === 'UF' ? String(o.amount).replace('.', ',') : String(o.amount));
    setDue(toUserDate(o.nextDueOn));
    setEvery(o.everyMonths === 12 ? '12' : '1');
    setAccount(o.accountNumber ?? '');
    setTotal(o.installmentsTotal ? String(o.installmentsTotal) : '');
    setPaid(o.installmentsPaid != null ? String(o.installmentsPaid) : '');
    setVehicleId(o.vehicleId ?? 0);
    setPropertyId(o.propertyId ?? 0);
    setMethodId(o.paymentMethodId ?? 0);
    setFilled(true);
  }, [o, filled]);

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
    const saved = await save.run(household.id, obligationId, {
      kind,
      name: name.trim(),
      currency,
      amount,
      nextDueOn,
      everyMonths: Number(every),
      accountNumber: account.trim() || undefined,
      installmentsTotal,
      installmentsPaid,
      vehicleId: kind === 'vehicle_doc' && vehicleId ? vehicleId : undefined,
      propertyId: kind === 'mortgage' && propertyId ? propertyId : undefined,
      paymentMethodId: methodId || null,
    });
    if (saved) navigation.goBack();
  };

  const onDelete = async () => {
    if (!obligationId) return;
    const ok = await confirmDanger(`¿Eliminar ${name.trim() || 'esta cuenta'}?`, 'También se borra su historial de pagos. No se puede recuperar.');
    if (ok && (await remove.run(obligationId))) navigation.popToTop();
  };

  if (obligationId && !filled) {
    return <Screen edges={['bottom']}>{existing.error ? <Text color="danger">{existing.error}</Text> : <LoadingState />}</Screen>;
  }

  return (
    <Screen edges={['bottom']}>
      <ChoiceChips label="Tipo" options={KINDS} value={kind} onChange={pickKind} error={show('kind')} />
      {kind === 'vehicle_doc' && (vehicles.data?.length ?? 0) > 0 && (
        <ChoiceChips<number>
          label="Vehículo"
          options={[...(vehicles.data ?? []).map((v) => ({ value: v.id, label: v.name, icon: 'car-sport-outline' as const })), { value: 0, label: 'Ninguno' }]}
          value={vehicleId}
          onChange={setVehicleId}
        />
      )}
      {kind === 'mortgage' && (properties.data?.length ?? 0) > 0 && (
        <ChoiceChips<number>
          label="Propiedad"
          options={[...(properties.data ?? []).map((p) => ({ value: p.id, label: p.name, icon: 'home-outline' as const })), { value: 0, label: 'Ninguna' }]}
          value={propertyId}
          onChange={setPropertyId}
        />
      )}
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
      {(methods.data?.length ?? 0) > 0 && (
        <ChoiceChips<number>
          label="Se paga con"
          options={[
            ...methodChoices(methods.data ?? []),
            ...(methodId && !methods.data?.some((m) => m.id === methodId) ? [{ value: methodId, label: 'Medio archivado' }] : []),
            { value: 0, label: 'Sin definir' },
          ]}
          value={methodId}
          onChange={setMethodId}
        />
      )}
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      <Button label={obligationId ? 'Guardar cambios' : 'Guardar cuenta'} size="lg" block loading={save.pending} onPress={submit} />
      {obligationId && <Button label="Eliminar cuenta" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
