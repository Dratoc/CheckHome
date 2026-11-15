import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Checkbox, EmptyState, QueryView, Screen, SectionHeader, Text, TextField } from '../components';
import { useMutation, useQuery } from '../hooks/useQuery';
import * as api from '../services/api';
import type { Member, ShoppingItem } from '../services/types';
import { useHousehold } from '../state/SessionProvider';
import { useTheme } from '../theme';
import { confirmDanger } from '../utils/confirm';

/** Lista de compras compartida del hogar: cualquiera agrega, marca lo que compró y limpia lo comprado. */
export function ShoppingScreen() {
  const t = useTheme();
  const { household } = useHousehold();
  const query = useQuery(() => api.listShopping(household.id), [household.id]);
  const members = useQuery(() => api.listMembers(household.id), [household.id]);
  const byId = new Map<number, Member>((members.data ?? []).map((m) => [m.id, m]));
  const nameOf = (id?: number) => (id === undefined ? undefined : byId.get(id)?.displayName.split(' ')[0]);

  const action = useMutation(async (fn: () => Promise<unknown>) => {
    await fn();
    await query.reload();
    return true as const;
  });
  // Al marcar, la casilla cambia al tiro sin esperar al servidor.
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const isBought = (i: ShoppingItem) => (flipped.has(i.id) ? !i.boughtAt : !!i.boughtAt);
  const toggle = async (i: ShoppingItem) => {
    setFlipped((s) => new Set(s).add(i.id));
    await action.run(() => api.toggleShoppingItem(i.id));
    setFlipped((s) => {
      const n = new Set(s);
      n.delete(i.id);
      return n;
    });
  };

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    const ok = await action.run(() => api.addShoppingItem(household.id, name.trim(), quantity.trim() || undefined));
    if (ok) {
      setName('');
      setQuantity('');
    }
  };

  const remove = (i: ShoppingItem) => action.run(() => api.deleteShoppingItem(i.id));
  const clearBought = async () => {
    const ok = await confirmDanger('¿Limpiar lo comprado?', 'Se sacan de la lista todas las cosas marcadas como compradas.', 'Limpiar');
    if (ok) await action.run(() => api.clearBoughtShopping(household.id));
  };

  const row = (i: ShoppingItem) => {
    const bought = isBought(i);
    const by = nameOf(i.boughtBy);
    const hint = [i.quantity, bought && i.boughtAt && by ? `Lo compró ${by}` : !bought ? (nameOf(i.addedBy) ? `Lo anotó ${nameOf(i.addedBy)}` : undefined) : undefined]
      .filter(Boolean)
      .join(' · ');
    return (
      <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Checkbox label={i.name} hint={hint || undefined} checked={bought} onChange={() => toggle(i)} />
        </View>
        <Pressable
          onPress={() => remove(i)}
          accessibilityRole="button"
          accessibilityLabel={`Quitar ${i.name} de la lista`}
          hitSlop={8}
          style={({ pressed }) => ({ padding: t.spacing.xs, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="close" size={20} color={t.colors.textMuted} />
        </Pressable>
      </View>
    );
  };

  return (
    <Screen edges={['bottom']}>
      <Card padding="md">
        <TextField label="¿Qué hay que comprar?" value={name} onChangeText={setName} placeholder="Ej: Leche" maxLength={100} onSubmitEditing={add} />
        <TextField label="Cantidad (opcional)" value={quantity} onChangeText={setQuantity} placeholder="Ej: 2 cajas" maxLength={40} onSubmitEditing={add} />
        <Button label="Agregar a la lista" size="sm" variant="secondary" disabled={!name.trim()} onPress={add} />
      </Card>
      {action.error && (
        <Text color="danger" accessibilityRole="alert">
          {action.error}
        </Text>
      )}
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyState title="Lista vacía" message="Anota lo que falta en la casa y márcalo cuando lo compres. Todos en el hogar ven la misma lista." />
          </Card>
        }
      >
        {(rows) => {
          const pending = rows.filter((i) => !isBought(i));
          const bought = rows.filter(isBought);
          return (
            <>
              <SectionHeader title={pending.length === 1 ? 'Falta 1 cosa' : `Faltan ${pending.length} cosas`} />
              <Card padding="md">
                {pending.length > 0 ? (
                  pending.map(row)
                ) : (
                  <Text variant="caption" color="textMuted">
                    ¡Está todo comprado!
                  </Text>
                )}
              </Card>
              {bought.length > 0 && (
                <>
                  <SectionHeader title="Comprado" />
                  <Card padding="md">
                    {bought.map(row)}
                    <Button label="Limpiar lo comprado" variant="ghost" size="sm" block onPress={clearBought} />
                  </Card>
                </>
              )}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
