/**
 * Cuentas del cierre del mes, sin base de datos (se prueban en test/closing.test.js).
 *
 * Idea: a cada persona le toca su % de (gastos del hogar + meta de ahorro), más sus gastos personales.
 * Lo que aportó es lo que salió de su bolsillo: débito o efectivo propio, pagos de la tarjeta y depósitos al
 * ahorro. Un gasto con tarjeta de crédito no es aporte de nadie hasta que alguien paga la tarjeta.
 * La diferencia entre lo que aportó y lo que le tocaba dice quién le transfiere a quién.
 */

const round = (n) => Math.round(n);

/**
 * Porcentaje de cada miembro (suma 1).
 * 1. Si alguien tiene un % fijo, se usan los % fijos (los que no tienen, 0).
 * 2. Si no, en proporción a sus sueldos registrados (monto habitual de sus fuentes de ingreso).
 * 3. Si nadie registró sueldo, partes iguales.
 */
export function computeShares(members, incomeByUser = {}) {
  const ids = members.map((m) => m.userId);
  if (!ids.length) return { source: 'equal', shares: {} };
  const manual = members.some((m) => m.sharePct != null);
  const weights = manual ? members.map((m) => Number(m.sharePct ?? 0)) : ids.map((id) => Number(incomeByUser[id] ?? 0));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return { source: 'equal', shares: Object.fromEntries(ids.map((id) => [id, 1 / ids.length])) };
  return { source: manual ? 'manual' : 'income', shares: Object.fromEntries(ids.map((id, i) => [id, weights[i] / total])) };
}

/** Transferencias mínimas: los que deben le pagan a los que pusieron de más. */
export function settle(balances) {
  const debtors = balances.filter((b) => b.balance <= -1).map((b) => ({ ...b, left: -b.balance }));
  const creditors = balances.filter((b) => b.balance >= 1).map((b) => ({ ...b, left: b.balance }));
  debtors.sort((a, b) => b.left - a.left);
  creditors.sort((a, b) => b.left - a.left);
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (round(amount) >= 1) transfers.push({ fromUserId: debtors[i].userId, toUserId: creditors[j].userId, amount: round(amount) });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left < 1) i++;
    if (creditors[j].left < 1) j++;
  }
  return transfers;
}

/**
 * @param {object} p
 * @param {{userId:number}[]} p.members
 * @param {Record<number, number>} p.shares        fracción de cada uno (suma 1)
 * @param {number} p.household                     gastos del hogar del ciclo (incluye cuentas pagadas)
 * @param {Record<number, number>} p.personal      gastos personales de cada uno
 * @param {Record<number, {expenses:number, cardPayments:number, savings:number}>} p.paid  aportes reales
 * @param {{ownerUserId:number, pending:number}[]} p.cards  lo que falta pagar de cada tarjeta en este ciclo
 * @param {number} p.savingsGoal
 * @param {number} p.savingsDeposited
 */
export function computeClosing({ members, shares, household, personal, paid, cards, savingsGoal, savingsDeposited }) {
  const savingsShortfall = Math.max(0, savingsGoal - savingsDeposited);
  const pendingCard = cards.reduce((s, c) => s + Math.max(0, c.pending), 0);

  const rows = members.map((m) => {
    const share = shares[m.userId] ?? 0;
    const p = paid[m.userId] ?? { expenses: 0, cardPayments: 0, savings: 0 };
    const own = personal[m.userId] ?? 0;
    const expectedHousehold = share * household;
    const expectedSavings = share * savingsGoal;
    const paidTotal = p.expenses + p.cardPayments + p.savings;
    // Lo que falta: la tarjeta la paga su dueño (se puede anotar otra cosa) y el ahorro lo pone cada uno según su %.
    const cardToPay = cards.filter((c) => c.ownerUserId === m.userId).reduce((s, c) => s + Math.max(0, c.pending), 0);
    const savingsToDeposit = share * savingsShortfall;
    return {
      userId: m.userId,
      share,
      expectedHousehold,
      expectedSavings,
      personal: own,
      expected: expectedHousehold + expectedSavings + own,
      paid: p,
      paidTotal,
      cardToPay,
      savingsToDeposit,
      balance: paidTotal + cardToPay + savingsToDeposit - (expectedHousehold + expectedSavings + own),
    };
  });

  // Si lo aportado no calza exacto con lo esperado (ahorro de más, un cargo de la tarjeta sin anotar), la
  // diferencia se reparte con el mismo %, para que las transferencias cuadren.
  const residual = rows.reduce((s, r) => s + r.balance, 0);
  for (const r of rows) r.balance -= r.share * residual;

  const out = rows.map((r) => ({
    userId: r.userId,
    sharePct: Math.round(r.share * 1000) / 10,
    expectedHousehold: round(r.expectedHousehold),
    expectedSavings: round(r.expectedSavings),
    personal: round(r.personal),
    expected: round(r.expected),
    paidExpenses: round(r.paid.expenses),
    paidCard: round(r.paid.cardPayments),
    paidSavings: round(r.paid.savings),
    paidTotal: round(r.paidTotal),
    cardToPay: round(r.cardToPay),
    savingsToDeposit: round(r.savingsToDeposit),
    balance: round(r.balance),
  }));

  return {
    pendingCard: round(pendingCard),
    savingsShortfall: round(savingsShortfall),
    // Final cuando no falta pagar tarjeta ni depositar ahorro: las transferencias ya no van a cambiar.
    isFinal: round(pendingCard) === 0 && round(savingsShortfall) === 0,
    members: out,
    transfers: settle(rows),
  };
}
