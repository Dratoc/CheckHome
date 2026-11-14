import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';
import { Badge, IconCircle, ListItem, Text } from '../../components';
import type { BadgeTone } from '../../components';
import type { Choice } from '../../components/ChoiceChips';
import type { Attachment, AttachmentKind, ObligationView } from '../../services/types';
import { useTheme } from '../../theme';
import { formatShortDate } from '../../utils/dates';
import { formatBytes } from '../../utils/pickDocument';

export const attachmentKindLabel: Record<AttachmentKind, string> = {
  circulation_permit: 'Permiso de circulación',
  technical_review: 'Revisión técnica',
  soap: 'SOAP',
  insurance: 'Seguro',
  registration: 'Padrón',
  license: 'Licencia de conducir',
  deed: 'Escritura',
  lease: 'Contrato de arriendo',
  property_tax: 'Contribuciones',
  other: 'Otro',
};

const VEHICLE_KINDS: AttachmentKind[] = ['circulation_permit', 'technical_review', 'soap', 'insurance', 'registration', 'license', 'other'];
const PROPERTY_KINDS: AttachmentKind[] = ['deed', 'lease', 'property_tax', 'insurance', 'other'];

export function attachmentKindChoices(owner: 'vehicle' | 'property'): Choice<AttachmentKind>[] {
  return (owner === 'vehicle' ? VEHICLE_KINDS : PROPERTY_KINDS).map((k) => ({ value: k, label: attachmentKindLabel[k] }));
}

/** Adivina el tipo de documento por el nombre del papel ("Revisión técnica 2027" → technical_review). */
export function kindForObligation(o: Pick<ObligationView, 'name' | 'kind'>): AttachmentKind {
  const n = o.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (n.includes('revision')) return 'technical_review';
  if (n.includes('soap')) return 'soap';
  if (n.includes('permiso')) return 'circulation_permit';
  if (n.includes('seguro')) return 'insurance';
  if (n.includes('contribuc')) return 'property_tax';
  return 'other';
}

export function attachmentBadge(a: Attachment): { label: string; tone: BadgeTone } | undefined {
  if (a.status === 'expired') return { label: 'Vencido', tone: 'danger' };
  if (a.status === 'expires_soon') return { label: a.daysLeft === 0 ? 'Vence hoy' : `Vence en ${a.daysLeft} d`, tone: 'warning' };
  if (a.status === 'ok') return { label: 'Vigente', tone: 'success' };
  return undefined;
}

function subtitle(a: Attachment, compact?: boolean) {
  const type = a.contentType === 'application/pdf' ? 'PDF' : 'Foto';
  const due = a.expiresOn && !compact ? `Vence ${formatShortDate(a.expiresOn)} ${a.expiresOn.slice(0, 4)} · ` : '';
  return `${due}${type} · ${formatBytes(a.sizeBytes)}`;
}

type RowsProps = {
  items: Attachment[];
  onOpen: (a: Attachment) => void;
  onEdit: (a: Attachment) => void;
  /** Id del documento que se está abriendo */
  opening?: number;
  /** Bajo su papel: "Ver documento", sin repetir el nombre ni el vencimiento */
  compact?: boolean;
};

/** Filas de documentos: tocar abre el archivo; el lápiz abre la edición. */
export function AttachmentRows({ items, onOpen, onEdit, opening, compact }: RowsProps) {
  const t = useTheme();
  return (
    <>
      {items.map((a) => {
        const b = compact ? undefined : attachmentBadge(a);
        return (
          <ListItem
            key={a.id}
            title={opening === a.id ? 'Abriendo…' : compact ? 'Ver documento' : a.title}
            subtitle={subtitle(a, compact)}
            leading={<IconCircle name={a.contentType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} tone="neutral" />}
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                {b && <Badge label={b.label} tone={b.tone} dot />}
                <Pressable onPress={() => onEdit(a)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Editar ${a.title}`}>
                  <Ionicons name="create-outline" size={20} color={t.colors.textMuted} />
                </Pressable>
              </View>
            }
            onPress={() => onOpen(a)}
            divider
          />
        );
      })}
    </>
  );
}

export function AttachmentHint({ text }: { text: string }) {
  return (
    <Text variant="caption" color="textMuted">
      {text}
    </Text>
  );
}
