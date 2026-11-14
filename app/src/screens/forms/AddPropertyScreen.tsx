import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';

const saveProperty = (householdId: number, propertyId: number | undefined, input: api.PropertyInput) =>
  propertyId ? api.updateProperty(propertyId, input) : api.createProperty(householdId, input);

/** Nueva propiedad (o editar una): nombre y dirección. El dividendo y el arriendo se agregan después. */
export function AddPropertyScreen({ navigation, route }: RootScreenProps<'AddProperty'>) {
  const { household } = useHousehold();
  const property = route.params?.property;
  const save = useMutation(saveProperty);
  const remove = useMutation(api.deleteProperty);
  const [name, setName] = useState(property?.name ?? '');
  const [address, setAddress] = useState(property?.address ?? '');
  const [submitted, setSubmitted] = useState(false);
  const nameError = name.trim().length < 2 ? 'Ponle un nombre.' : undefined;

  const submit = async () => {
    setSubmitted(true);
    if (nameError) return;
    const p = await save.run(household.id, property?.id, { name: name.trim(), address: address.trim() || undefined });
    if (p) navigation.goBack();
  };

  const onDelete = async () => {
    if (!property) return;
    const ok = await confirmDanger(`¿Eliminar ${property.name}?`, 'Se borran sus documentos adjuntos. Su dividendo y su arriendo no se borran: quedan como cuentas e ingresos sueltos, con su historial.');
    if (ok && (await remove.run(property.id))) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Depto Ñuñoa" error={submitted ? nameError : undefined} maxLength={100} autoFocus={!property} />
      <TextField label="Dirección (opcional)" value={address} onChangeText={setAddress} placeholder="Ej: Av. Irarrázaval 1234, depto 501" maxLength={200} />
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      <Button label={property ? 'Guardar cambios' : 'Guardar propiedad'} size="lg" block loading={save.pending} onPress={submit} />
      {property && <Button label="Eliminar propiedad" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
