import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, LoadingState, QueryView, Screen, Text, TextField, formatCLP } from '../components';
import { useMutation, useQuery } from '../hooks/useQuery';
import type { RootScreenProps } from '../navigation/types';
import * as api from '../services/api';
import type { Category } from '../services/types';
import { useHousehold } from '../state/SessionProvider';
import { useTheme } from '../theme';
import { confirmDanger } from '../utils/confirm';
import { parseUserDate, toUserDate } from '../utils/dates';

const saveExpense = (householdId: number, userId: number, expenseId: number | undefined, input: api.ExpenseInput, spentOn?: string) =>
  expenseId && spentOn ? api.updateExpense(expenseId, { ...input, spentOn }) : api.addExpense(householdId, userId, input);

/** Gasto rápido: monto, categoría y una nota. Siempre visible para todo el hogar. Con expenseId, lo edita. */
export function AddExpenseScreen({ navigation, route }: RootScreenProps<'AddExpense'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const expenseId = route.params?.expenseId;
  const categories = useQuery(() => api.listExpenseCategories(household.id), [household.id]);
  const existing = useQuery(() => (expenseId ? api.getExpense(expenseId) : Promise.resolve(undefined)), [expenseId]);
  const save = useMutation(saveExpense);
  const remove = useMutation(api.deleteExpense);
  const [raw, setRaw] = useState('');
  const [categoryId, setCategoryId] = useState<number>();
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
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
    setFilled(true);
  }, [e, filled]);

  const amount = Number(raw.replace(/\D/g, '')) || 0;
  const spentOn = expenseId ? parseUserDate(date) : undefined;
  const amountError = submitted && amount <= 0 ? 'Escribe cuánto gastaste.' : undefined;
  const categoryError = submitted && !categoryId ? 'Elige una categoría.' : undefined;
  const dateError = submitted && expenseId && !spentOn ? 'Escribe la fecha como 15-12-2026.' : undefined;
  const readOnly = !!expenseId && e?.canEdit === false;

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0 || !categoryId || (expenseId && !spentOn)) return;
    const saved = await save.run(household.id, user.id, expenseId, { amount, categoryId, description }, spentOn);
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

      <TextField label="Nota (opcional)" value={description} onChangeText={setDescription} placeholder="Ej: Pan y huevos" maxLength={120} />
      {expenseId ? (
        <TextField label="Fecha" value={date} onChangeText={setDate} placeholder="dd-mm-aaaa" keyboardType="numbers-and-punctuation" error={dateError} />
      ) : (
        <Text variant="caption" color="textMuted">
          Los gastos se ven siempre en todo el hogar.
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
