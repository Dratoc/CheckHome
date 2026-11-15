import { useState } from 'react';
import { Button, ChoiceChips, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { PetSpecies } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { SPECIES } from '../../utils/categories';
import { confirmDanger } from '../../utils/confirm';
import { parseUserDate, toUserDate, today } from '../../utils/dates';

const SPECIES_CHOICES = SPECIES.map((s) => ({ value: s.value, label: `${s.emoji} ${s.label}` }));

const savePet = (householdId: number, petId: number | undefined, input: api.PetInput) => (petId ? api.updatePet(petId, input) : api.createPet(householdId, input));

/** Nueva mascota (o editar una): nombre, qué es y cuándo nació. Sus rutinas y fechas se agregan desde su ficha. */
export function AddPetScreen({ navigation, route }: RootScreenProps<'AddPet'>) {
  const { household } = useHousehold();
  const pet = route.params?.pet;
  const save = useMutation(savePet);
  const remove = useMutation(api.deletePet);
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<PetSpecies>(pet?.species ?? 'dog');
  const [birth, setBirth] = useState(pet?.birthDate ? toUserDate(pet.birthDate) : '');
  const [submitted, setSubmitted] = useState(false);

  const birthDate = birth.trim() ? parseUserDate(birth) : undefined;
  const errors = {
    name: name.trim().length < 1 ? 'Ponle su nombre.' : undefined,
    birth: birth.trim() && !birthDate ? 'Usa el formato día-mes-año, como 01-03-2020.' : birthDate && birthDate > today() ? 'No puede ser una fecha futura.' : undefined,
  };

  const submit = async () => {
    setSubmitted(true);
    if (errors.name || errors.birth) return;
    const saved = await save.run(household.id, pet?.id, { name: name.trim(), species, birthDate });
    if (!saved) return;
    // Recién creada, se abre su ficha para agregarle rutinas y vacunas.
    if (pet) navigation.goBack();
    else navigation.replace('Pet', { petId: saved.id, name: saved.name });
  };

  const onDelete = async () => {
    if (!pet) return;
    const ok = await confirmDanger(`¿Eliminar a ${pet.name}?`, 'Se borran sus fechas clave y documentos. Sus rutinas no se borran: quedan como rutinas de la casa.');
    if (ok && (await remove.run(pet.id))) navigation.popToTop();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Luna" error={submitted ? errors.name : undefined} maxLength={50} autoFocus={!pet} />
      <ChoiceChips label="¿Qué es?" options={SPECIES_CHOICES} value={species} onChange={setSpecies} />
      <TextField
        label="Nació (opcional)"
        value={birth}
        onChangeText={setBirth}
        placeholder="01-03-2020"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        hint="Si no sabes el día exacto, pon uno aproximado: sirve para mostrar su edad."
        error={submitted ? errors.birth : undefined}
      />
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      <Button label={pet ? 'Guardar cambios' : 'Guardar mascota'} size="lg" block loading={save.pending} onPress={submit} />
      {pet && <Button label="Eliminar mascota" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
