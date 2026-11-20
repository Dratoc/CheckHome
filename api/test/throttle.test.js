import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrottle } from '../src/throttle.js';

test('el freno corta al llegar al máximo y se libera al pasar la ventana', () => {
  const t = createThrottle({ max: 2, windowMs: 60_000, message: 'Espera {min} min.' });
  t.check('ana', 0);
  t.hit('ana', 0);
  t.hit('ana', 1000);
  assert.throws(() => t.check('ana', 2000), (e) => e.status === 429 && e.message === 'Espera 1 min.');
  t.check('beto', 2000); // otra clave no se ve afectada
  t.check('ana', 61_000);
  t.hit('ana', 61_000);
  t.reset('ana');
  t.check('ana', 61_500);
});
