import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ChoiceChips, IconCircle, ListItem, Screen, Text, TextField } from '../../components';
import { useMutation } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import type { AttachmentKind } from '../../services/types';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { confirmDanger } from '../../utils/confirm';
import { parseUserDate, toUserDate } from '../../utils/dates';
import { formatBytes, PickError, pickPdf, pickPhoto, takePhoto, type PickedFile } from '../../utils/pickDocument';
import { attachmentKindChoices, attachmentKindLabel } from '../assets/attachmentUi';

/**
 * Adjuntar un documento digital (foto o PDF) a un vehículo, una propiedad o un papel con vencimiento.
 * Con attachment, edita su tipo, nombre y vencimiento; el archivo se cambia subiendo uno nuevo.
 */
export function AddAttachmentScreen({ navigation, route }: RootScreenProps<'AddAttachment'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const p = route.params;
  const editing = p.attachment;
  const owner = (editing ? (editing.vehicleId ? 'vehicle' : 'property') : p.owner) ?? 'vehicle';

  const [kind, setKind] = useState<AttachmentKind | undefined>(editing?.kind ?? p.kind);
  const [title, setTitle] = useState(editing?.title ?? p.title ?? (p.kind ? attachmentKindLabel[p.kind] : ''));
  const [titleTouched, setTitleTouched] = useState(Boolean(editing || p.title));
  const [due, setDue] = useState(() => {
    const iso = editing?.expiresOn ?? p.expiresOn;
    return iso ? toUserDate(iso) : '';
  });
  const [file, setFile] = useState<PickedFile>();
  const [pickError, setPickError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const upload = useMutation(api.uploadAttachment);
  const update = useMutation(api.updateAttachment);
  const remove = useMutation(api.deleteAttachment);
  const open = useMutation(api.openAttachment);

  const expiresOn = due.trim() ? parseUserDate(due) : undefined;
  const errors = {
    kind: kind ? undefined : 'Elige qué documento es.',
    title: title.trim().length < 2 ? 'Ponle un nombre.' : undefined,
    due: due.trim() && !expiresOn ? 'Usa el formato día-mes-año, como 31-05-2027.' : undefined,
    file: editing || file ? undefined : 'Elige la foto o el PDF.',
  };

  const onKind = (k: AttachmentKind) => {
    setKind(k);
    if (!titleTouched) setTitle(attachmentKindLabel[k]);
  };

  const choose = async (picker: () => Promise<PickedFile | undefined>) => {
    setPickError(undefined);
    setPicking(true);
    try {
      const f = await picker();
      if (f) setFile(f);
    } catch (e) {
      setPickError(e instanceof PickError ? e.message : 'No pudimos abrir el archivo. Intenta de nuevo.');
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    setSubmitted(true);
    if (errors.kind || errors.title || errors.due || errors.file || !kind) return;
    const meta = { kind, title: title.trim(), expiresOn };
    const done = editing
      ? await update.run(editing.id, meta)
      : file &&
        (await upload.run(household.id, {
          ...meta,
          vehicleId: p.vehicleId,
          propertyId: p.propertyId,
          obligationId: p.obligationId,
          fileName: file.fileName,
          contentType: file.contentType,
          data: file.data,
        }));
    if (done) navigation.goBack();
  };

  const onDelete = async () => {
    if (!editing) return;
    const ok = await confirmDanger(`¿Eliminar ${editing.title}?`, 'Se borra el archivo de la app. Si no tienes otra copia, guárdala antes.');
    if (ok && (await remove.run(editing.id))) navigation.goBack();
  };

  const error = pickError ?? upload.error ?? update.error ?? remove.error ?? open.error;

  return (
    <Screen edges={['bottom']}>
      <ChoiceChips label="¿Qué documento es?" options={attachmentKindChoices(owner)} value={kind} onChange={onKind} error={submitted ? errors.kind : undefined} />
      <TextField
        label="Nombre"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setTitleTouched(true);
        }}
        placeholder="Ej: Revisión técnica 2026"
        maxLength={100}
        error={submitted ? errors.title : undefined}
      />
      <TextField
        label="Vence (opcional)"
        value={due}
        onChangeText={setDue}
        placeholder="31-05-2027"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={submitted ? errors.due : undefined}
      />

      {editing ? (
        <Card padding="md">
          <ListItem
            title={editing.fileName}
            subtitle={`${editing.contentType === 'application/pdf' ? 'PDF' : 'Foto'} · ${formatBytes(editing.sizeBytes)}`}
            leading={<IconCircle name={editing.contentType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} tone="primary" />}
          />
          <Button label="Ver documento" variant="secondary" block loading={open.pending} onPress={() => open.run(editing.id)} />
        </Card>
      ) : (
        <Card padding="md">
          {file ? (
            <ListItem
              title={file.fileName}
              subtitle={`${file.contentType === 'application/pdf' ? 'PDF' : 'Foto comprimida'} · ${formatBytes(file.sizeBytes)}`}
              leading={<IconCircle name={file.contentType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} tone="primary" />}
              trailing={<Text variant="label" color="primary">Listo</Text>}
              divider
            />
          ) : (
            <Text variant="caption" color={submitted && errors.file ? 'danger' : 'textMuted'}>
              {submitted && errors.file ? errors.file : 'Sube el PDF oficial (por ejemplo, el certificado que llega por correo) o una foto del papel. Máximo 4 MB.'}
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
            <Button label="Elegir PDF" size="sm" variant="secondary" disabled={picking} onPress={() => choose(pickPdf)} />
            <Button label="Tomar foto" size="sm" variant="ghost" disabled={picking} onPress={() => choose(takePhoto)} />
            <Button label="Foto de la galería" size="sm" variant="ghost" disabled={picking} onPress={() => choose(pickPhoto)} />
          </View>
        </Card>
      )}

      {error && (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button label={editing ? 'Guardar cambios' : 'Guardar documento'} size="lg" block loading={upload.pending || update.pending} disabled={picking} onPress={submit} />
      {editing && <Button label="Eliminar documento" variant="ghost" block loading={remove.pending} onPress={onDelete} />}
    </Screen>
  );
}
