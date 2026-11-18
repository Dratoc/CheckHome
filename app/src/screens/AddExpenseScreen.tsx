import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Amount, Button, Card, ChoiceChips, LoadingState, QueryView, Screen, SegmentedControl, Text, TextField, formatCLP } from '../components';
import { useMutation, useQuery } from '../hooks/useQuery';
import type { RootScreenProps } from '../navigation/types';
import * as api from '../services/api';
import type { Category } from '../services/types';
import { useHousehold } from '../state/SessionProvider';
import { useTheme } from '../theme';
import { confirmDanger } from '../utils/confirm';
import { formatShortDate, parseUserDate, toUserDate } from '../utils/dates';
import { methodChoices } from './money/paymentMethodUi';

const saveExpense = (householdId: number, userId: number, expenseId: number | undefined, input: api.ExpenseInput, spentOn?: string) =>
  expenseId && spentOn ? api.updateExpense(expenseId, { ...input, spentOn }) : api.addExpense(householdId, userId, input);

type Kind = 'expense' | 'refund';

/**
 * Gasto rápido: monto, categoría, con qué se pagó y si es del hogar o personal. Siempre visible para todo el hogar.
 * Con expenseId, lo edita.
 *
 * También anota reembolsos: plata que entra una sola vez por un gasto (el seguro que devuelve parte del psicólogo,
 * una devolución en la tienda). Se guarda como gasto negativo, así resta en el mes en que llega, en su medio de pago
 * y en el cierre. Con refundOf abre ya vinculado a ese gasto, con su categoría y de quién era.
 */
export function AddExpenseScreen({ navigation, route }: RootScreenProps<'AddExpense'>) {
  const t = useTheme();
  const { user, household } = useHousehold();
  const expenseId = route.params?.expenseId;
  const refundOf = route.params?.refundOf;
  const categories = useQuery(() => api.listExpenseCategories(household.id), [household.id]);
  const existing = useQuery(() => (expenseId ? api.getExpense(expenseId) : Promise.resolve(undefined)), [expenseId]);
  const original = useQuery(() => (refundOf ? api.getExpense(refundOf) : Promise.resolve(undefined)), [refundOf]);
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
  const [kind, setKind] = useState<Kind>(refundOf ? 'refund' : 'expense');
  // Gasto que se reembolsa (undefined = ninguno)
  const [linkId, setLinkId] = useState<number | undefined>(refundOf);
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
    setKind(e.isRefund ? 'refund' : 'expense');
    setLinkId(e.refundOfId);
    setFilled(true);
  }, [e, filled]);

  // Reembolso de un gasto: parte con su categoría, de quién era y una nota.
  const o = original.data;
  useEffect(() => {
    if (!o || filled) return;
    setCategoryId(o.categoryId);
    setPersonalId(o.personalUserId ?? 0);
    setDescription(`Reembolso ${o.description || ''}`.trim());
    setFilled(true);
  }, [o, filled]);

  const isRefund = kind === 'refund';
  useEffect(() => {
    navigation.setOptions({ title: expenseId ? (isRefund ? 'Editar reembolso' : 'Editar gasto') : isRefund ? 'Nuevo reembolso' : 'Nuevo gasto' });
  }, [navigation, expenseId, isRefund]);
  const link = linkId ? (o && o.id === linkId ? { title: o.description, amount: o.amount, spentOn: o.spentOn } : e?.refundOf) : undefined;

  const methodRows = methods.data ?? [];
  // Un gasto propone la tarjeta de crédito; un reembolso, la cuenta (débito), que es donde suele llegar la plata.
  const preferred = isRefund ? 'debit' : 'credit';
  const chosenMethod = methodId ?? (expenseId ? 0 : (methodRows.find((m) => m.kind === preferred) ?? methodRows[0])?.id ?? 0);
  // Un gasto viejo con un medio ya archivado lo sigue mostrando.
  const methodOptions = [...methodChoices(methodRows), ...(chosenMethod && !methodRows.some((m) => m.id === chosenMethod) ? [{ value: chosenMethod, label: 'Medio archivado' }] : []), { value: 0, label: 'Sin indicar' }];

  const amount = Number(raw.replace(/\D/g, '')) || 0;
  const spentOn = expenseId ? parseUserDate(date) : undefined;
  const amountError = submitted && amount <= 0 ? (isRefund ? 'Escribe cuánto te devolvieron.' : 'Escribe cuánto gastaste.') : undefined;
  const categoryError = submitted && !categoryId ? 'Elige una categoría.' : undefined;
  const dateError = submitted && expenseId && !spentOn ? 'Escribe la fecha como 15-12-2026.' : undefined;
  const readOnly = !!expenseId && e?.canEdit === false;

  const submit = async () => {
    setSubmitted(true);
    if (amount <= 0 || !categoryId || (expenseId && !spentOn)) return;
    const input = { amount, categoryId, description, paymentMethodId: chosenMethod || null, personalUserId: personalId || null, isRefund, refundOfId: (isRefund && linkId) || null };
    const saved = await save.run(household.id, user.id, expenseId, input, spentOn);
    if (saved) navigation.goBack();
  };

  const onDelete = async () => {
    if (!expenseId || !(await confirmDanger(isRefund ? '¿Eliminar este reembolso?' : '¿Eliminar este gasto?', 'Se borra para todo el hogar y no se puede recuperar.'))) return;
    if (await remove.run(expenseId)) navigation.goBack();
  };

  if ((expenseId || refundOf) && !filled) {
    const error = existing.error ?? original.error;
    return (
      <Screen edges={['bottom']}>
        {error ? <Text color="danger">{error}</Text> : <LoadingState />}
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
      {/* Un gasto que ya tiene reembolsos no se puede convertir en reembolso. */}
      {!readOnly && !e?.refunds?.length && (
        <SegmentedControl<Kind>
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'refund', label: 'Reembolso' },
          ]}
          value={kind}
          onChange={setKind}
        />
      )}
      {isRefund && link && (
        <Card tone="tinted">
          <Text variant="label" color="textMuted">
            Reembolso de
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.sm }}>
            <Text variant="body" style={{ flex: 1 }}>
              {link.title || 'Gasto'} · {formatShortDate(link.spentOn)}
            </Text>
            <Amount value={link.amount} />
          </View>
          {!readOnly && <Button label="No vincular a ese gasto" size="sm" variant="ghost" onPress={() => setLinkId(undefined)} />}
        </Card>
      )}
      <TextField
        label={isRefund ? 'Monto devuelto' : 'Monto'}
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

      <ChoiceChips<number> label={isRefund ? '¿Dónde llegó la plata?' : 'Pagado con'} options={methodOptions} value={chosenMethod} onChange={setMethodId} />
      {methods.data && methodRows.length === 0 && (
        <Text variant="caption" color="textMuted">
          Agrega tu tarjeta, débito y efectivo en Cuentas › Medios de pago para saber de dónde salió cada peso.
        </Text>
      )}
      {(members.data?.length ?? 0) > 1 && (
        <ChoiceChips<number>
          label={isRefund ? '¿De quién era el gasto?' : '¿De quién es?'}
          options={[{ value: 0, label: 'Del hogar', icon: 'home-outline' }, ...(members.data ?? []).map((m) => ({ value: m.id, label: `Personal de ${m.displayName.split(' ')[0]}` }))]}
          value={personalId}
          onChange={setPersonalId}
        />
      )}

      <TextField label="Nota (opcional)" value={description} onChangeText={setDescription} placeholder={isRefund ? 'Ej: Reembolso seguro psicólogo' : 'Ej: Pan y huevos'} maxLength={120} />
      {expenseId ? (
        <TextField label="Fecha" value={date} onChangeText={setDate} placeholder="dd-mm-aaaa" keyboardType="numbers-and-punctuation" error={dateError} />
      ) : (
        <Text variant="caption" color="textMuted">
          {isRefund
            ? 'Un reembolso es plata que entra una sola vez por un gasto. Resta de los gastos del mes en que llega (no cambia un mes ya cerrado) y, si es del hogar, se reparte con el mismo % de cada uno.'
            : 'Los gastos se ven siempre en todo el hogar. Los del hogar se reparten según el % de cada uno; los personales, los paga su dueño.'}
        </Text>
      )}
      {!isRefund && e?.refunds?.length ? (
        <Text variant="caption" color="textMuted">
          Ya te devolvieron {formatCLP(e.refunds.reduce((sum, r) => sum + r.amount, 0))} de este gasto
          {e.refunds.length > 1 ? ` en ${e.refunds.length} reembolsos` : ` el ${formatShortDate(e.refunds[0].spentOn)}`}.
        </Text>
      ) : null}
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      {!readOnly && <Button label={expenseId ? 'Guardar cambios' : isRefund ? 'Guardar reembolso' : 'Guardar gasto'} size="lg" block loading={save.pending} onPress={submit} />}
      {/* Del gasto guardado se anota su reembolso: queda vinculado y parte con sus datos. */}
      {expenseId && e && !e.isRefund && (
        <Button label="Anotar un reembolso de este gasto" variant="secondary" block onPress={() => navigation.replace('AddExpense', { refundOf: expenseId })} />
      )}
      {expenseId && !readOnly && <Button label={isRefund ? 'Eliminar reembolso' : 'Eliminar gasto'} variant="ghost" block loading={remove.pending} onPress={onDelete} />}
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
