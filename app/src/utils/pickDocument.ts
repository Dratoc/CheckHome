import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { AttachmentContentType } from '../services/types';

/** Mismo tope que la API (4 MB). Las fotos se comprimen y quedan muy por debajo. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** Lado más largo de la foto guardada: se lee bien un certificado y pesa ~300 KB. */
const MAX_SIDE = 1600;

export type PickedFile = { fileName: string; contentType: AttachmentContentType; data: string; sizeBytes: number };

export class PickError extends Error {}

const sizeOf = (base64: string) => Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
const stripPrefix = (b64: string) => b64.replace(/^data:[^,]*;base64,/, '');

/** "1,2 MB" o "340 KB" */
export function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Achica la foto y la guarda como JPEG: el papel sigue legible y la base gratis no se llena. */
async function compressPhoto(asset: ImagePicker.ImagePickerAsset): Promise<PickedFile> {
  const longest = Math.max(asset.width, asset.height);
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_SIDE) ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  const data = stripPrefix(out.base64 ?? '');
  if (!data) throw new PickError('No pudimos leer la foto. Intenta de nuevo.');
  const base = (asset.fileName ?? 'foto').replace(/\.[^.]+$/, '');
  return { fileName: `${base}.jpg`, contentType: 'image/jpeg', data, sizeBytes: sizeOf(data) };
}

export async function takePhoto(): Promise<PickedFile | undefined> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new PickError('Para fotografiar el documento, permite el uso de la cámara en los ajustes del teléfono.');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  return res.canceled || !res.assets[0] ? undefined : compressPhoto(res.assets[0]);
}

export async function pickPhoto(): Promise<PickedFile | undefined> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  return res.canceled || !res.assets[0] ? undefined : compressPhoto(res.assets[0]);
}

/** PDF tal cual (ya viene liviano si es el certificado digital oficial). */
export async function pickPdf(): Promise<PickedFile | undefined> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, base64: true });
  const asset = res.canceled ? undefined : res.assets[0];
  if (!asset) return undefined;
  if (asset.size && asset.size > MAX_FILE_BYTES) throw new PickError(`El PDF pesa ${formatBytes(asset.size)}; el máximo es 4 MB.`);
  const data = stripPrefix(asset.base64 ?? '');
  if (!data) throw new PickError('No pudimos leer el PDF. Intenta de nuevo.');
  const sizeBytes = sizeOf(data);
  if (sizeBytes > MAX_FILE_BYTES) throw new PickError(`El PDF pesa ${formatBytes(sizeBytes)}; el máximo es 4 MB.`);
  return { fileName: asset.name || 'documento.pdf', contentType: 'application/pdf', data, sizeBytes };
}
