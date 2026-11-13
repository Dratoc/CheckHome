import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { confirmDanger } from '../../utils/confirm';

/** Cambia el título de una tarea del backlog o la elimina. */
export function EditTaskScreen({ navigation, route }: RootScreenProps<'EditTask'>) {
  const { taskId } = route.params;
  const save = useMutation(api.renameTask);
  const remove = useMutation(api.deleteTask);
  const [title, setTitle] = useState(route.params.title);
  const [submitted, setSubmitted] = useState(false);
  const invalid = title.trim().length < 3;

  const submit = async () => {
    setSubmitted(true);
    if (invalid) return;
    if (await save.run(taskId, title.trim())) navigation.goBack();
  };

  const onDelete = async () => {
    const ok = await confirmDanger('¿Eliminar esta tarea?', 'Se borran sus votos y, si ya estaba terminada, sus puntos salen del ranking.');
    if (ok && (await remove.run(taskId))) navigation.goBack();
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Tarea" value={title} onChangeText={setTitle} error={submitted && invalid ? 'Escribe al menos 3 letras.' : undefined} maxLength={150} onSubmitEditing={submit} />
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
