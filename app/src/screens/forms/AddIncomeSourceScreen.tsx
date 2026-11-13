import { useState } from 'react';
import { Button, Checkbox, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { parseClp, showClp } from './money';

/** Fuente de ingreso: se define una vez (sueldo, arriendo) con su día de pago. */
export function AddIncomeSourceScreen({ navigation }: RootScreenProps<'AddIncomeSource'>) {
  const { household } = useHousehold();
  const save = useMutation(api.createIncomeSource);
  const [name, setName] = useState('');
  const [day, setDay] = useState('');
  const [raw, setRaw] = useState('');
  const [isPrivate, setPrivate] = useState(false);
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
    const s = await save.run(household.id, { name: name.trim(), payDay, expectedAmount, isPrivate });
    if (s) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Sueldo, Arriendo depto" error={submitted ? errors.name : undefined} maxLength={100} autoFocus />
      <TextField label="Día del mes en que llega" value={day} onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="1" error={submitted ? errors.day : undefined} />
      <TextField label="Monto habitual" prefix="$" value={showClp(expectedAmount)} onChangeText={setRaw} keyboardType="number-pad" placeholder="0" hint="Se usa como sugerencia al anotar cada pago." />
      <Checkbox label="Privado" hint="Solo tú ves esta fuente y sus pagos." checked={isPrivate} onChange={setPrivate} />
      {save.error && (
        <Text color="danger" accessibilityRole="alert">
          {save.error}
        </Text>
      )}
      <Button label="Guardar fuente" size="lg" block loading={save.pending} onPress={submit} />
    </Screen>
  );
}
