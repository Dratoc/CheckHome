import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { confirmDanger } from '../../utils/confirm';

const saveVehicle = (householdId: number, vehicleId: number | undefined, input: api.VehicleInput) =>
  vehicleId ? api.updateVehicle(vehicleId, input) : api.createVehicle(householdId, input);

/** Nuevo vehículo (o editar uno): nombre, patente, modelo y año. Los papeles se agregan después. */
export function AddVehicleScreen({ navigation, route }: RootScreenProps<'AddVehicle'>) {
  const { household } = useHousehold();
  const vehicle = route.params?.vehicle;
  const save = useMutation(saveVehicle);
  const remove = useMutation(api.deleteVehicle);
  const [name, setName] = useState(vehicle?.name ?? '');
  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '');
  const [submitted, setSubmitted] = useState(false);

  const yearNum = year ? Number(year) : undefined;
  const errors = {
    name: name.trim().length < 2 ? 'Ponle un nombre.' : undefined,
    year: yearNum !== undefined && !(yearNum >= 1950 && yearNum <= 2100) ? 'Un año como 2019.' : undefined,
  };

  const submit = async () => {
    setSubmitted(true);
    if (errors.name || errors.year) return;
    const v = await save.run(household.id, vehicle?.id, { name: name.trim(), plate: plate.trim() || undefined, model: model.trim() || undefined, year: yearNum });
    if (v) navigation.goBack();
  };

  const onDelete = async () => {
    if (!vehicle) return;
    const ok = await confirmDanger(`¿Eliminar ${vehicle.name}?`, 'Sus papeles no se borran: quedan en "Por pagar" como cuentas sueltas, con su historial.');
    if (ok && (await remove.run(vehicle.id))) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Auto de Hernán" error={submitted ? errors.name : undefined} maxLength={100} autoFocus={!vehicle} />
      <TextField label="Patente (opcional)" value={plate} onChangeText={(v) => setPlate(v.toUpperCase())} placeholder="ABCD12" autoCapitalize="characters" maxLength={10} />
      <TextField label="Marca y modelo (opcional)" value={model} onChangeText={setModel} placeholder="Ej: Toyota Yaris" maxLength={100} />
      <TextField label="Año (opcional)" value={year} onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="2019" error={submitted ? errors.year : undefined} />
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      <Button label={vehicle ? 'Guardar cambios' : 'Guardar vehículo'} size="lg" block loading={save.pending} onPress={submit} />
      {vehicle && <Button label="Eliminar vehículo" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
