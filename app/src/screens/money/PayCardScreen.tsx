import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { parseClp, showClp } from '../forms/money';

/** Pagar la tarjeta: es pago de deuda, no un gasto. Cuenta como aporte de quien paga en el cierre del mes. */
export function PayCardScreen({ navigation, route }: RootScreenProps<'PayCard'>) {
  const { methodId, name, statementEnd, label, suggested } = route.params;
  const pay = useMutation(api.payCard);
  const [raw, setRaw] = useState(suggested > 0 ? String(suggested) : '');
  const [submitted, setSubmitted] = useState(false);
  const amount = parseClp(raw);

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0) return;
    if (await pay.run(methodId, amount, statementEnd)) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="body">
        {name}, estado del {label}.
      </Text>
      <TextField label="Monto pagado" prefix="$" value={showClp(amount)} onChangeText={setRaw} keyboardType="number-pad" placeholder="0" error={submitted && amount <= 0 ? 'Escribe cuánto pagaste.' : undefined} autoFocus />
      <Text variant="caption" color="textMuted">
        Queda a tu nombre: en el cierre del mes cuenta como lo que aportaste. No se suma como gasto, porque cada compra ya está anotada.
      </Text>
      {pay.error && (
        <Text color="danger" accessibilityRole="alert">
          {pay.error}
        </Text>
      )}
      <Button label="Anotar pago" size="lg" block loading={pay.pending} onPress={submit} />
    </Screen>
  );
}
