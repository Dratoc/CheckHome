/** Pruebas del cierre del mes y de los ciclos de la tarjeta (sin base de datos). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeClosing, computeShares, settle } from '../src/closing.js';
import { cardStatementIn, cycleOf, dueDateOf, statementPaidOn } from '../src/cycle.js';

test('ciclo con corte 19: del 20 al 19', () => {
  assert.deepEqual(cycleOf('2026-11-14', 19), { start: '2026-10-20', end: '2026-11-19' });
  assert.deepEqual(cycleOf('2026-11-19', 19), { start: '2026-10-20', end: '2026-11-19' });
  assert.deepEqual(cycleOf('2026-11-20', 19), { start: '2026-11-20', end: '2026-12-19' });
  assert.deepEqual(cycleOf('2026-12-25', 19), { start: '2026-12-20', end: '2027-01-19' });
});

test('sin corte es el mes calendario; corte 31 se ajusta a meses cortos', () => {
  assert.deepEqual(cycleOf('2026-02-10', null), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(cycleOf('2026-03-05', 30), { start: '2026-03-01', end: '2026-03-30' });
  assert.deepEqual(cycleOf('2026-03-01', 30), { start: '2026-03-01', end: '2026-03-30' });
  assert.deepEqual(cycleOf('2026-02-28', 30), { start: '2026-01-31', end: '2026-02-28' });
});

test('el pago del 5 paga el estado que cerró el 19 anterior y vence el 5', () => {
  assert.deepEqual(statementPaidOn('2026-12-05', 19), { start: '2026-10-20', end: '2026-11-19' });
  assert.deepEqual(statementPaidOn('2026-11-19', 19), { start: '2026-10-20', end: '2026-11-19' });
  assert.equal(dueDateOf('2026-11-19', 5), '2026-12-05');
  assert.equal(dueDateOf('2026-11-01', 25), '2026-11-25');
  assert.deepEqual(cardStatementIn({ start: '2026-11-01', end: '2026-11-30' }, 19), { start: '2026-10-20', end: '2026-11-19' });
});

test('porcentajes: fijos, por sueldo o iguales', () => {
  const ms = [{ userId: 1 }, { userId: 2 }];
  assert.deepEqual(computeShares(ms, { 1: 1_500_000, 2: 1_000_000 }), { source: 'income', shares: { 1: 0.6, 2: 0.4 } });
  assert.deepEqual(computeShares(ms, {}), { source: 'equal', shares: { 1: 0.5, 2: 0.5 } });
  assert.deepEqual(computeShares([{ userId: 1, sharePct: 70 }, { userId: 2, sharePct: 30 }], { 1: 1, 2: 1 }).shares, { 1: 0.7, 2: 0.3 });
});

test('cierre: Hernán paga la tarjeta y su esposa le transfiere la diferencia', () => {
  const r = computeClosing({
    members: [{ userId: 1 }, { userId: 2 }],
    shares: { 1: 0.6, 2: 0.4 },
    household: 550_000, // 500 mil con tarjeta + 50 mil con débito de ella
    personal: { 1: 50_000, 2: 100_000 }, // ambos con la tarjeta
    paid: { 1: { expenses: 0, cardPayments: 650_000, savings: 200_000 }, 2: { expenses: 50_000, cardPayments: 0, savings: 100_000 } },
    cards: [{ ownerUserId: 1, pending: 0 }],
    savingsGoal: 300_000,
    savingsDeposited: 300_000,
  });
  assert.equal(r.isFinal, true);
  assert.equal(r.members[0].expected, 560_000);
  assert.equal(r.members[1].expected, 440_000);
  assert.deepEqual(r.transfers, [{ fromUserId: 2, toUserId: 1, amount: 290_000 }]);
});

test('cierre provisorio: la tarjeta aún no se paga y se supone que la paga su dueño', () => {
  const r = computeClosing({
    members: [{ userId: 1 }, { userId: 2 }],
    shares: { 1: 0.5, 2: 0.5 },
    household: 100_000,
    personal: { 2: 50_000 },
    paid: {},
    cards: [{ ownerUserId: 1, pending: 150_000 }],
    savingsGoal: 0,
    savingsDeposited: 0,
  });
  assert.equal(r.isFinal, false);
  assert.equal(r.pendingCard, 150_000);
  assert.deepEqual(r.transfers, [{ fromUserId: 2, toUserId: 1, amount: 100_000 }]);
});

test('ahorro de más y diferencias se reparten con el mismo %', () => {
  const r = computeClosing({
    members: [{ userId: 1 }, { userId: 2 }],
    shares: { 1: 0.5, 2: 0.5 },
    household: 0,
    personal: {},
    paid: { 1: { expenses: 0, cardPayments: 0, savings: 400_000 } },
    cards: [],
    savingsGoal: 300_000,
    savingsDeposited: 400_000,
  });
  assert.deepEqual(r.transfers, [{ fromUserId: 2, toUserId: 1, amount: 200_000 }]);
  assert.equal(r.members.reduce((s, m) => s + m.balance, 0), 0);
});

test('settle con tres personas', () => {
  const t = settle([{ userId: 1, balance: 300 }, { userId: 2, balance: -100 }, { userId: 3, balance: -200 }]);
  assert.deepEqual(t, [{ fromUserId: 3, toUserId: 1, amount: 200 }, { fromUserId: 2, toUserId: 1, amount: 100 }]);
});
