import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, QueryView, Screen, Text, TextField, formatCLP } from '../components';
import { useMutation, useQuery } from '../hooks/useQuery';
import type { RootScreenProps } from '../navigation/types';
import * as api from '../services/api';
import type { Category } from '../services/types';
import { useHousehold } from '../state/SessionProvider';
import { useTheme } from '../theme';

/** Gasto rápido: monto, categoría y una nota. Siempre visible para todo el hogar. */
export function AddExpenseScreen({ navigation }: RootScreenProps<'AddExpense'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const categories = useQuery(() => api.listExpenseCategories(household.id), [household.id]);
  const save = useMutation(api.addExpense);
  const [raw, setRaw] = useState('');
  const [categoryId, setCategoryId] = useState<number>();
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const amount = Number(raw.replace(/\D/g, '')) || 0;
  const amountError = submitted && amount <= 0 ? 'Escribe cuánto gastaste.' : undefined;
  const categoryError = submitted && !categoryId ? 'Elige una categoría.' : undefined;

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0 || !categoryId) return;
    const e = await save.run(household.id, user.id, { amount, categoryId, description });
    if (e) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Monto"
        prefix="$"
        value={amount ? formatCLP(amount).replace(/[^\d.]/g, '') : ''}
        onChangeText={setRaw}
        keyboardType="number-pad"
        placeholder="0"
        error={amountError}
        autoFocus
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
      <Text variant="caption" color="textMuted">
        Los gastos se ven siempre en todo el hogar.
      </Text>
      {save.error && (
        <Text color="danger" accessibilityRole="alert">
          {save.error}
        </Text>
      )}
      <Button label="Guardar gasto" size="lg" block loading={save.pending} onPress={submit} />
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
