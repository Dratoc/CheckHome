import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, ChoiceChips, LoadingState, QueryView, Screen, Text, TextField, formatCLP } from '../components';
import { useMutation, useQuery } from '../hooks/useQuery';
import type { RootScreenProps } from '../navigation/types';
import * as api from '../services/api';
import type { Category } from '../services/types';
import { useHousehold } from '../state/SessionProvider';
import { useTheme } from '../theme';
import { confirmDanger } from '../utils/confirm';
import { parseUserDate, toUserDate } from '../utils/dates';
import { methodChoices } from './money/paymentMethodUi';

const saveExpense = (householdId: number, userId: number, expenseId: number | undefined, input: api.ExpenseInput, spentOn?: string) =>
  expenseId && spentOn ? api.updateExpense(expenseId, { ...input, spentOn }) : api.addExpense(householdId, userId, input);

/**
 * Gasto rápido: monto, categoría, con qué se pagó y si es del hogar o personal. Siempre visible para todo el hogar.
 * Con expenseId, lo edita.
 */
export function AddExpenseScreen({ navigation, route }: RootScreenProps<'AddExpense'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const expenseId = route.params?.expenseId;
  const categories = useQuery(() => api.listExpenseCategories(household.id), [household.id]);
  const existing = useQuery(() => (expenseId ? api.getExpense(expenseId) : Promise.resolve(undefined)), [expenseId]);
  const methods = useQuery(() => api.listPaymentMethods(household.id), [household.id]);
  const members = useQuery(() => api.listMembers(household.id), [household.id]);
  const save = useMutation(saveExpense);
  const remove = useMutation(api.deleteExpense);
  const [raw, setRaw] = useState('');
  const [categoryId, setCategoryId] = useState<number>();
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  // undefined = todavía no elegido (al crear se propone la primera tarjeta de crédito); 0 = sin indicar
  const [methodId, setMethodId] = useState<number>();
  // 0 = del hogar
  const [personalId, setPersonalId] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [filled, setFilled] = useState(false);

  // Al editar, se rellena el formulario una sola vez con el gasto guardado.
  const e = existing.data;
  useEffect(() => {
    if (!e || filled) return;
    setRaw(String(e.amount));
    setCategoryId(e.categoryId);
    setDescription(e.description);
    setDate(toUserDate(e.spentOn));
    setMethodId(e.paymentMethodId ?? 0);
    setPersonalId(e.personalUserId ?? 0);
    setFilled(true);
  }, [e, filled]);

  const methodRows = methods.data ?? [];
  const chosenMethod = methodId ?? (expenseId ? 0 : (methodRows.find((m) => m.kind === 'credit') ?? methodRows[0])?.id ?? 0);
  // Un gasto viejo con un medio ya archivado lo sigue mostrando.
  const methodOptions = [...methodChoices(methodRows), ...(chosenMethod && !methodRows.some((m) => m.id === chosenMethod) ? [{ value: chosenMethod, label: 'Medio archivado' }] : []), { value: 0, label: 'Sin indicar' }];

  const amount = Number(raw.replace(/\D/g, '')) || 0;
  const spentOn = expenseId ? parseUserDate(date) : undefined;
  const amountError = submitted && amount <= 0 ? 'Escribe cuánto gastaste.' : undefined;
  const categoryError = submitted && !categoryId ? 'Elige una categoría.' : undefined;
  const dateError = submitted && expenseId && !spentOn ? 'Escribe la fecha como 15-12-2026.' : undefined;
  const readOnly = !!expenseId && e?.canEdit === false;

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0 || !categoryId || (expenseId && !spentOn)) return;
    const input = { amount, categoryId, description, paymentMethodId: chosenMethod || null, personalUserId: personalId || null };
    const saved = await save.run(household.id, user.id, expenseId, input, spentOn);
    if (saved) navigation.goBack();
  };

  const onDelete = async () => {
    if (!expenseId || !(await confirmDanger('¿Eliminar este gasto?', 'Se borra para todo el hogar y no se puede recuperar.'))) return;
    if (await remove.run(expenseId)) navigation.goBack();
  };

  if (expenseId && !filled) {
    return (
      <Screen edges={['bottom']}>
        {existing.error ? <Text color="danger">{existing.error}</Text> : <LoadingState />}
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {readOnly && (
        <Text variant="caption" color="textMuted">
          Solo quien anotó este gasto o un administrador del hogar puede cambiarlo.
        </Text>
      )}
      <TextField
        label="Monto"
        prefix="$"
        value={amount ? formatCLP(amount).replace(/[^\d.]/g, '') : ''}
        onChangeText={setRaw}
        keyboardType="number-pad"
        placeholder="0"
        error={amountError}
        autoFocus={!expenseId}
      />

      <View style={{ gap: t.spacing.sm }}>
        <Text variant="label">Categoría</Text>
        <QueryView query={categories}>
          {(rows) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }} accessibilityRole="radiogroup">
              {rows.map((c) => (
                <CategoryChip key={c.id} category={c} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
              ))}
            </View>
          )}
        </QueryView>
        {categoryError && (
          <Text variant="caption" color="danger">
            {categoryError}
          </Text>
        )}
      </View>

      <ChoiceChips<number> label="Pagado con" options={methodOptions} value={chosenMethod} onChange={setMethodId} />
      {methods.data && methodRows.length === 0 && (
        <Text variant="caption" color="textMuted">
          Agrega tu tarjeta, débito y efectivo en Cuentas › Medios de pago para saber de dónde salió cada peso.
        </Text>
      )}
      {(members.data?.length ?? 0) > 1 && (
        <ChoiceChips<number>
          label="¿De quién es?"
          options={[{ value: 0, label: 'Del hogar', icon: 'home-outline' }, ...(members.data ?? []).map((m) => ({ value: m.id, label: `Personal de ${m.displayName.split(' ')[0]}` }))]}
          value={personalId}
          onChange={setPersonalId}
        />
      )}

      <TextField label="Nota (opcional)" value={description} onChangeText={setDescription} placeholder="Ej: Pan y huevos" maxLength={120} />
      {expenseId ? (
        <TextField label="Fecha" value={date} onChangeText={setDate} placeholder="dd-mm-aaaa" keyboardType="numbers-and-punctuation" error={dateError} />
      ) : (
        <Text variant="caption" color="textMuted">
          Los gastos se ven siempre en todo el hogar. Los del hogar se reparten según el % de cada uno; los personales, los paga su dueño.
        </Text>
      )}
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      {!readOnly && <Button label={expenseId ? 'Guardar cambios' : 'Guardar gasto'} size="lg" block loading={save.pending} onPress={submit} />}
      {expenseId && !readOnly && <Button label="Eliminar gasto" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}

function CategoryChip({ category, selected, onPress }: { category: Category; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={category.name}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        minHeight: t.sizes.touchMin,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.pill,
        backgroundColor: selected ? t.colors.primary : t.colors.surfaceAlt,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons
        name={category.icon as keyof typeof Ionicons.glyphMap}
        size={18}
        color={selected ? t.colors.onPrimary : t.colors.textMuted}
      />
      <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
        {category.name}
      </Text>
    </Pressable>
  );
}
