import { useState } from 'react';
import { Button, Checkbox, ChoiceChips, Screen, Text, TextField } from '../../components';
import { useMutation, useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';
import { parseClp, showClp } from './money';

const saveSource = (householdId: number, sourceId: number | undefined, input: api.IncomeSourceInput) =>
  sourceId ? api.updateIncomeSource(sourceId, input) : api.createIncomeSource(householdId, input);

/** Fuente de ingreso: se define una vez (sueldo, arriendo) con su día de pago. Con source, la edita. */
export function AddIncomeSourceScreen({ navigation, route }: RootScreenProps<'AddIncomeSource'>) {
  const { household } = useHousehold();
  const source = route.params?.source;
  const save = useMutation(saveSource);
  const remove = useMutation(api.deleteIncomeSource);
  const [name, setName] = useState(source?.name ?? '');
  const [day, setDay] = useState(source ? String(source.payDay) : '');
  const [raw, setRaw] = useState(source?.expectedAmount ? String(source.expectedAmount) : '');
  const [isPrivate, setPrivate] = useState(source?.isPrivate ?? false);
  const properties = useQuery(() => api.listProperties(household.id), [household.id]);
  // 0 = no es arriendo de una propiedad
  const [propertyId, setPropertyId] = useState(source?.propertyId ?? route.params?.propertyId ?? 0);
  const [submitted, setSubmitted] = useState(false);

  const payDay = Number(day);
  const expectedAmount = parseClp(raw);
  const errors = {
    name: name.trim().length < 2 ? 'Ponle un nombre.' : undefined,
    day: !(payDay >= 1 && payDay <= 31) ? 'Un día entre 1 y 31.' : undefined,
  };

  const submit = async () => {
    setSubmitted(true);
    if (errors.name || errors.day) return;
    const s = await save.run(household.id, source?.id, { name: name.trim(), payDay, expectedAmount, isPrivate, propertyId: propertyId || undefined });
    if (s) navigation.goBack();
  };

  const onDelete = async () => {
    if (!source) return;
    const ok = await confirmDanger(`¿Eliminar ${source.name}?`, 'También se borran todos los pagos anotados en esta fuente. No se puede recuperar.');
    if (ok && (await remove.run(source.id))) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Sueldo, Arriendo depto" error={submitted ? errors.name : undefined} maxLength={100} autoFocus={!source} />
      <TextField label="Día del mes en que llega" value={day} onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="1" error={submitted ? errors.day : undefined} />
      <TextField label="Monto habitual" prefix="$" value={showClp(expectedAmount)} onChangeText={setRaw} keyboardType="number-pad" placeholder="0" hint="Se usa como sugerencia al anotar cada pago." />
      {(properties.data?.length ?? 0) > 0 && (
        <ChoiceChips<number>
          label="¿Es arriendo de una propiedad?"
          options={[{ value: 0, label: 'No' }, ...(properties.data ?? []).map((p) => ({ value: p.id, label: p.name, icon: 'home-outline' as const }))]}
          value={propertyId}
          onChange={setPropertyId}
        />
      )}
      <Checkbox label="Privado" hint="Solo tú ves esta fuente y sus pagos." checked={isPrivate} onChange={setPrivate} />
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      <Button label={source ? 'Guardar cambios' : 'Guardar fuente'} size="lg" block loading={save.pending} onPress={submit} />
      {source && <Button label="Eliminar fuente" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
