import type { IconName } from '../components/IconCircle';
import type { PetSpecies, TaskCategory } from '../services/types';

/**
 * Categorías fijas de las tareas, con su nombre e ícono. Lista corta a propósito: así el filtro sirve en cualquier
 * casa. La API tiene la misma lista y las mismas palabras en api/src/categories.js: si se cambia aquí, se cambia allá.
 */
export const CATEGORIES: { value: TaskCategory; label: string; icon: IconName }[] = [
  { value: 'kitchen', label: 'Cocina', icon: 'restaurant-outline' },
  { value: 'cleaning', label: 'Limpieza', icon: 'sparkles-outline' },
  { value: 'bathroom', label: 'Baño', icon: 'water-outline' },
  { value: 'laundry', label: 'Ropa', icon: 'shirt-outline' },
  { value: 'pets', label: 'Mascotas', icon: 'paw-outline' },
  { value: 'garden', label: 'Plantas', icon: 'leaf-outline' },
  { value: 'vehicles', label: 'Autos', icon: 'car-sport-outline' },
  { value: 'repairs', label: 'Arreglos', icon: 'construct-outline' },
];

const byValue = new Map(CATEGORIES.map((c) => [c.value, c]));

export const categoryInfo = (c?: TaskCategory) => (c ? byValue.get(c) : undefined);

// El orden importa: "comida del perro" es Mascotas antes que Cocina, "limpiar el baño" es Baño antes que Limpieza.
const KEYWORDS: [TaskCategory, string[]][] = [
  ['pets', ['perr', 'gat', 'mascota', 'pase', 'arena', 'veterinari', 'vacuna', 'antiparasit', 'pecera', 'acuario']],
  ['vehicles', ['auto', 'camioneta', 'moto', 'bencina', 'neumatico', 'aceite']],
  ['bathroom', ['bano', 'ducha', 'inodoro', 'wc', 'lavamanos']],
  ['laundry', ['ropa', 'tender', 'planchar', 'doblar', 'sabana', 'toalla', 'lavadora']],
  ['kitchen', ['loza', 'plato', 'cocin', 'almuerzo', 'cena', 'desayuno', 'comida', 'horno', 'refri', 'lavavajilla', 'microondas']],
  ['garden', ['regar', 'planta', 'jardin', 'pasto', 'podar', 'cesped', 'macetero']],
  ['cleaning', ['aspirar', 'barrer', 'trapear', 'limpi', 'polvo', 'basura', 'ordenar', 'ventana', 'piso', 'cama']],
  ['repairs', ['arregl', 'repar', 'ampolleta', 'pintar', 'tramite', 'gasfiter', 'enchufe']],
];

const normalize = (s: string) =>
  ` ${s}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

/** Adivina la categoría por el nombre mientras se escribe ("Pasear a Luna" → Mascotas). */
export function suggestCategory(name: string): TaskCategory | undefined {
  const n = normalize(name);
  return KEYWORDS.find(([, words]) => words.some((w) => n.includes(` ${w}`)))?.[0];
}

export const SPECIES: { value: PetSpecies; label: string; emoji: string }[] = [
  { value: 'dog', label: 'Perro', emoji: '🐶' },
  { value: 'cat', label: 'Gato', emoji: '🐱' },
  { value: 'bird', label: 'Ave', emoji: '🐦' },
  { value: 'fish', label: 'Pez', emoji: '🐟' },
  { value: 'rabbit', label: 'Conejo', emoji: '🐰' },
  { value: 'other', label: 'Otra', emoji: '🐾' },
];

export const speciesEmoji = (s: PetSpecies) => SPECIES.find((x) => x.value === s)?.emoji ?? '🐾';

/** Fechas clave típicas, para elegir con un toque al crear una. */
export const PET_KEY_DATES: { title: string; everyMonths: number }[] = [
  { title: 'Vacuna antirrábica', everyMonths: 12 },
  { title: 'Vacuna óctuple', everyMonths: 12 },
  { title: 'Antiparasitario interno', everyMonths: 3 },
  { title: 'Antiparasitario externo', everyMonths: 1 },
  { title: 'Control veterinario', everyMonths: 12 },
  { title: 'Peluquería', everyMonths: 2 },
];

export const VEHICLE_KEY_DATES: { title: string; everyMonths: number }[] = [
  { title: 'Mantención', everyMonths: 12 },
  { title: 'Cambio de aceite', everyMonths: 6 },
  { title: 'Rotación de neumáticos', everyMonths: 6 },
  { title: 'Cambio de neumáticos', everyMonths: 36 },
];

/** Rutinas típicas de una mascota, para crearlas con un toque. */
export const PET_ROUTINES: { name: string; days?: number[] }[] = [{ name: 'Comida' }, { name: 'Agua fresca' }, { name: 'Paseo' }, { name: 'Limpiar arena' }];
