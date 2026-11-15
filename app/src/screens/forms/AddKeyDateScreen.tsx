import { useState } from 'react';
import { View } from 'react-native';
import { Button, ChoiceChips, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { PET_KEY_DATES, VEHICLE_KEY_DATES } from '../../utils/categories';
import { confirmDanger } from '../../utils/confirm';
import { addMonths, formatShortDate, parseUserDate, toUserDate, today } from '../../utils/dates';

const REPEAT = [
  { value: 0, label: 'No se repite' },
  { value: 1, label: 'Cada mes' },
  { value: 3, label: 'Cada 3 meses' },
  { value: 6, label: 'Cada 6 meses' },
  { value: 12, label: 'Cada año' },
];

/**
 * Fecha clave de una mascota o un vehículo: la última vez que se hizo (vacuna, antiparasitario, mantención) y la
 * próxima. Si se repite, la próxima sale sola de la última. No es una cuenta: no tiene monto.
 */
export function AddKeyDateScreen({ navigation, route }: RootScreenProps<'AddKeyDate'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const { keyDate, petId, vehicleId } = route.params;
  const forPet = keyDate ? keyDate.petId !== undefined : petId !== undefined;
  const presets = forPet ? PET_KEY_DATES : VEHICLE_KEY_DATES;

  const [title, setTitle] = useState(keyDate?.title ?? '');
  const [last, setLast] = useState(keyDate?.lastOn ? toUserDate(keyDate.lastOn) : '');
  const [next, setNext] = useState(keyDate?.nextOn ? toUserDate(keyDate.nextOn) : '');
  const [nextTouched, setNextTouched] = useState(Boolean(keyDate?.nextOn));
  const [every, setEvery] = useState<number>(keyDate ? (keyDate.everyMonths ?? 0) : 12);
  const [submitted, setSubmitted] = useState(false);

  const create = useMutation((input: api.KeyDateInput) => api.createKeyDate(household.id, { petId, vehicleId }, input));
  const update = useMutation(api.updateKeyDate);
  const remove = useMutation(api.deleteKeyDate);

  const lastOn = last.trim() ? parseUserDate(last) : undefined;
  const typedNext = next.trim() ? parseUserDate(next) : undefined;
  // Si no se escribió la próxima a mano, sale de la última más la repetición.
  const computedNext = lastOn && every ? addMonths(lastOn, every) : undefined;
  const nextOn = nextTouched ? typedNext : computedNext;
  const repeatOptions = REPEAT.some((r) => r.value === every) ? REPEAT : [...REPEAT, { value: every, label: `Cada ${every} meses` }];

  const errors = {
    title: title.trim().length < 2 ? 'Ponle un nombre.' : undefined,
    last: last.trim() && !lastOn ? 'Usa el formato día-mes-año, como 10-03-2026.' : lastOn && lastOn > today() ? 'La última vez no puede ser futura.' : undefined,
    next: nextTouched && next.trim() && !typedNext ? 'Usa el formato día-mes-año, como 10-03-2027.' : undefined,
    none: !lastOn && !nextOn ? 'Anota la última vez, la próxima o ambas.' : undefined,
  };

  const pick = (p: { title: string; everyMonths: number }) => {
    setTitle(p.title);
    setEvery(p.everyMonths);
  };

  const submit = async () => {
    setSubmitted(true);
    if (errors.title || errors.last || errors.next || errors.none) return;
    const input = { title: title.trim(), lastOn, nextOn, everyMonths: every || undefined };
    const done = keyDate ? await update.run(keyDate.id, input) : await create.run(input);
    if (done) navigation.goBack();
  };

  const onDelete = async () => {
    if (!keyDate) return;
    const ok = await confirmDanger(`¿Eliminar ${keyDate.title}?`, 'Se pierde la última fecha anotada.');
    if (ok && (await remove.run(keyDate.id))) navigation.goBack();
  };

  const error = create.error ?? update.error ?? remove.error;

  return (
    <Screen edges={['bottom']}>
      {!keyDate && (
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Lo más común</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
            {presets.map((p) => (
              <Button key={p.title} label={p.title} size="sm" variant={title === p.title ? 'secondary' : 'ghost'} onPress={() => pick(p)} />
            ))}
          </View>
        </View>
      )}
      <TextField label="Nombre" value={title} onChangeText={setTitle} placeholder={forPet ? 'Ej: Vacuna antirrábica' : 'Ej: Mantención'} maxLength={100} error={submitted ? errors.title : undefined} />
      <View style={{ gap: t.spacing.xs }}>
        <TextField
          label="Última vez (opcional)"
          value={last}
          onChangeText={setLast}
          placeholder="10-03-2026"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          error={submitted ? errors.last : undefined}
        />
        <View style={{ alignItems: 'flex-start' }}>
          <Button label="Fue hoy" size="sm" variant="ghost" onPress={() => setLast(toUserDate(today()))} />
        </View>
      </View>
      <ChoiceChips label="¿Se repite?" options={repeatOptions} value={every} onChange={setEvery} />
      <TextField
        label="Próxima"
        value={nextTouched ? next : computedNext ? toUserDate(computedNext) : next}
        onChangeText={(v) => {
          setNext(v);
          setNextTouched(true);
        }}
        placeholder="10-03-2027"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        hint={!nextTouched && computedNext ? `Calculada: ${formatShortDate(computedNext)} ${computedNext.slice(0, 4)}. Puedes cambiarla.` : 'Te avisamos dos semanas antes.'}
        error={submitted ? (errors.next ?? errors.none) : undefined}
      />
      {error && (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label={keyDate ? 'Guardar cambios' : 'Guardar fecha'} size="lg" block loading={create.pending || update.pending} onPress={submit} />
      {keyDate && <Button label="Eliminar fecha" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
