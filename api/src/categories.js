/**
 * Categorías fijas de las tareas (rutinas y backlog). Es una lista corta a propósito: si cada hogar inventa las
 * suyas, terminan repetidas y el filtro deja de servir. La app tiene la misma lista en app/src/utils/categories.ts
 * (con ícono y nombre); si se cambia aquí, se cambia allá y en la restricción CHECK de la migración 0009.
 */
import { badRequest } from './errors.js';

export const TASK_CATEGORIES = ['kitchen', 'cleaning', 'bathroom', 'laundry', 'pets', 'garden', 'vehicles', 'repairs'];

// El orden importa: "comida del perro" es Mascotas antes que Cocina, "limpiar el baño" es Baño antes que Limpieza.
const KEYWORDS = [
  ['pets', ['perr', 'gat', 'mascota', 'pase', 'arena', 'veterinari', 'vacuna', 'antiparasit', 'pecera', 'acuario']],
  ['vehicles', ['auto', 'camioneta', 'moto', 'bencina', 'neumatico', 'aceite']],
  ['bathroom', ['bano', 'ducha', 'inodoro', 'wc', 'lavamanos']],
  ['laundry', ['ropa', 'tender', 'planchar', 'doblar', 'sabana', 'toalla', 'lavadora']],
  ['kitchen', ['loza', 'plato', 'cocin', 'almuerzo', 'cena', 'desayuno', 'comida', 'horno', 'refri', 'lavavajilla', 'microondas']],
  ['garden', ['regar', 'planta', 'jardin', 'pasto', 'podar', 'cesped', 'macetero']],
  ['cleaning', ['aspirar', 'barrer', 'trapear', 'limpi', 'polvo', 'basura', 'ordenar', 'ventana', 'piso', 'cama']],
  ['repairs', ['arregl', 'repar', 'ampolleta', 'pintar', 'tramite', 'gasfiter', 'enchufe']],
];

const normalize = (s) => ` ${s}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');

/** Adivina la categoría por el nombre ("Pasear a Luna" → pets). Sin pista, undefined. */
export function suggestCategory(name) {
  const n = normalize(String(name ?? ''));
  return KEYWORDS.find(([, words]) => words.some((w) => n.includes(` ${w}`)))?.[0];
}

/**
 * Categoría que llega en el cuerpo. Si no viene (clientes antiguos o el alta rápida del backlog), se adivina por el
 * nombre; null explícito la deja sin categoría. Si la tarea es de una mascota o un vehículo, manda eso.
 */
export function categoryInput(b, name, { keep, subject } = {}) {
  if (subject === 'pet') return 'pets';
  if (subject === 'vehicle') return 'vehicles';
  if (b.category === undefined) return keep !== undefined ? keep : (suggestCategory(name) ?? null);
  if (b.category === null || b.category === '') return null;
  if (!TASK_CATEGORIES.includes(b.category)) throw badRequest('La categoría no es válida.');
  return b.category;
}
