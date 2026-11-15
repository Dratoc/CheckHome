import { useState } from 'react';
import { Button, ChoiceChips, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { TaskCategory } from '../../services/types';
import { CATEGORIES } from '../../utils/categories';
import { confirmDanger } from '../../utils/confirm';

type CategoryChoice = TaskCategory | 'none';
const CATEGORY_CHOICES = [...CATEGORIES.map((c) => ({ value: c.value as CategoryChoice, label: c.label, icon: c.icon })), { value: 'none' as CategoryChoice, label: 'Sin categoría' }];

/** Cambia el título o la categoría de una tarea del backlog, o la elimina. */
export function EditTaskScreen({ navigation, route }: RootScreenProps<'EditTask'>) {
  const { taskId } = route.params;
  const save = useMutation(api.renameTask);
  const remove = useMutation(api.deleteTask);
  const [title, setTitle] = useState(route.params.title);
  const [category, setCategory] = useState<CategoryChoice>(route.params.category ?? 'none');
  const [submitted, setSubmitted] = useState(false);
  const invalid = title.trim().length < 3;

  const submit = async () => {
    setSubmitted(true);
    if (invalid) return;
    if (await save.run(taskId, title.trim(), category === 'none' ? null : category)) navigation.goBack();
  };

  const onDelete = async () => {
    const ok = await confirmDanger('¿Eliminar esta tarea?', 'Se borran sus votos y, si ya estaba terminada, sus puntos salen del ranking.');
    if (ok && (await remove.run(taskId))) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Tarea" value={title} onChangeText={setTitle} error={submitted && invalid ? 'Escribe al menos 3 letras.' : undefined} maxLength={150} onSubmitEditing={submit} />
      <ChoiceChips label="Categoría" options={CATEGORY_CHOICES} value={category} onChange={setCategory} />
      {(save.error || remove.error) && (
        <Text color="danger" accessibilityRole="alert">
          {save.error ?? remove.error}
        </Text>
      )}
      <Button label="Guardar cambios" size="lg" block loading={save.pending} onPress={submit} />
      <Button label="Eliminar tarea" variant="ghost" block loading={remove.pending} onPress={onDelete} />
    </Screen>
  );
}
