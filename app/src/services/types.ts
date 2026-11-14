/**
 * Tipos de dominio. Siguen el modelo de docs/mvp.md y db/migrations/ (en camelCase).
 * Cuando exista la API, sus respuestas deben calzar con estos tipos.
 */

export type User = {
  id: number;
  email: string;
  username: string;
  displayName: string;
};

export type Household = {
  id: number;
  name: string;
  inviteCode: string;
  currency: 'CLP';
};

export type MemberRole = 'admin' | 'member';

export type Member = User & { role: MemberRole };

/** Hogar visto por un usuario: incluye su rol y cuántos miembros tiene. */
export type MyHousehold = Household & { role: MemberRole; memberCount: number };

export type Category = {
  id: number;
  householdId: number;
  kind: 'income' | 'expense';
  name: string;
  icon: string;
};

export type IncomeSource = {
  id: number;
  householdId: number;
  userId: number;
  name: string;
  /** Día del mes en que suele llegar */
  payDay: number;
  expectedAmount: number;
  isPrivate: boolean;
  /** Arriendo: la propiedad que lo genera */
  propertyId?: number;
};

export type Income = {
  id: number;
  sourceId: number;
  householdId: number;
  userId: number;
  amount: number;
  receivedOn: string; // YYYY-MM-DD
  isPrivate: boolean;
};

export type Expense = {
  id: number;
  householdId: number;
  userId: number;
  categoryId: number;
  amount: number;
  description: string;
  spentOn: string; // YYYY-MM-DD
  /** Con qué se pagó (sin dato en gastos antiguos) */
  paymentMethodId?: number;
  /** Si es personal, de quién; sin dato = del hogar */
  personalUserId?: number;
};

export type ObligationKind = 'subscription' | 'utility' | 'mortgage' | 'loan' | 'vehicle_doc' | 'other';

export type Obligation = {
  id: number;
  householdId: number;
  kind: ObligationKind;
  name: string;
  currency: 'CLP' | 'UF';
  amount: number;
  nextDueOn: string; // YYYY-MM-DD
  /** Cada cuántos meses se repite (12 para papeles del auto) */
  everyMonths: number;
  accountNumber?: string;
  lastPaidOn?: string;
  /** Solo créditos: cuotas totales y pagadas */
  installmentsTotal?: number;
  installmentsPaid?: number;
  /** Papeles del auto: el vehículo al que pertenecen */
  vehicleId?: number;
  vehicleName?: string;
  /** Dividendo: la propiedad que se paga */
  propertyId?: number;
  propertyName?: string;
  /** Con qué se paga normalmente */
  paymentMethodId?: number;
};

export type ObligationPayment = {
  id: number;
  obligationId: number;
  userId: number;
  /** Nombre de quien pagó */
  paidBy: string;
  amountClp: number;
  ufValue?: number;
  paidOn: string;
  paymentMethodName?: string;
  /** Solo el último pago se puede deshacer */
  canUndo: boolean;
};

export type Frequency = 'daily' | 'weekly';

export type Routine = {
  id: number;
  householdId: number;
  name: string;
  frequency: Frequency;
  points: number;
};

export type RoutineCheck = {
  routineId: number;
  userId: number;
  /** Día (rutinas diarias) o lunes de la semana (rutinas semanales) */
  periodStart: string;
};

export type BacklogStatus = 'estimating' | 'open' | 'taken' | 'done';

export type BacklogTask = {
  id: number;
  householdId: number;
  title: string;
  status: BacklogStatus;
  /** Puntos acordados: el voto más alto */
  points?: number;
  takenBy?: number;
  doneOn?: string;
};

export type TaskVote = { taskId: number; userId: number; points: number };

/** Fila unificada para la lista de movimientos. */
export type Movement = {
  key: string;
  /** Id del gasto, ingreso o pago según kind */
  id: number;
  /** Solo pagos: la cuenta a la que pertenece */
  obligationId?: number;
  kind: 'income' | 'expense' | 'payment';
  title: string;
  subtitle: string;
  amount: number;
  date: string;
};

/** Gasto visto por quien lo abre: si puede cambiarlo (lo anotó o es administrador). */
export type ExpenseView = Expense & { canEdit: boolean };

export type IncomeView = Income & { sourceName: string };

export type ObligationStatus = 'overdue' | 'due_soon' | 'ok';

export type ObligationView = Obligation & { status: ObligationStatus; daysLeft: number; amountClp: number };

export type MonthSummary = {
  income: number;
  expenses: number;
  fixedPaid: number;
  fixedPending: number;
  balance: number;
};

export type RankingRow = { user: Member; points: number };

export type BacklogTaskView = BacklogTask & { votes: TaskVote[]; myVote?: number; pendingVoters: number };

export type Vehicle = {
  id: number;
  householdId: number;
  name: string;
  /** Patente, sin espacios ni guiones */
  plate?: string;
  model?: string;
  year?: number;
};

/** Vehículo con sus papeles (permiso, revisión técnica, SOAP, seguro). */
export type VehicleView = Vehicle & { documents: ObligationView[] };

export type Property = {
  id: number;
  householdId: number;
  name: string;
  address?: string;
};

/** Propiedad con su dividendo, su arriendo y lo pagado y recibido este mes. */
export type PropertyView = Property & {
  mortgages: ObligationView[];
  rentSources: IncomeSource[];
  rentThisMonth: number;
  mortgagePaidThisMonth: number;
};

// ---------- Medios de pago y cierre del mes ----------

export type PaymentMethodKind = 'credit' | 'debit' | 'cash';

export type PaymentMethod = {
  id: number;
  householdId: number;
  ownerUserId: number;
  ownerName?: string;
  kind: PaymentMethodKind;
  name: string;
  /** Solo crédito */
  cutDay?: number;
  dueDay?: number;
  isArchived: boolean;
};

/** Estado de cuenta de una tarjeta según lo anotado en la app. */
export type CardStatement = {
  methodId: number;
  name: string;
  ownerUserId: number;
  ownerName: string;
  start: string;
  end: string;
  label: string;
  dueOn: string;
  isClosed: boolean;
  /** Facturado según la app */
  charged: number;
  paid: number;
  pending: number;
};

export type CardStatementDetail = CardStatement & {
  prevEnd: string;
  nextEnd: string;
  charges: Movement[];
  payments: { id: number; amount: number; paidOn: string; userId: number; paidBy: string }[];
};

export type FinanceSettings = {
  /** Sin dato = mes calendario */
  cycleCutDay?: number;
  savingsGoal: number;
  /** De dónde salen los %: fijados a mano, por sueldos o partes iguales */
  shareSource: 'manual' | 'income' | 'equal';
  members: { userId: number; name: string; sharePct?: number; share: number }[];
};

export type SavingsDeposit = { id: number; userId: number; depositedBy: string; amount: number; depositedOn: string; note: string };

export type Savings = { goal: number; total: number; deposits: SavingsDeposit[] };

export type ClosingMember = {
  userId: number;
  name: string;
  sharePct: number;
  expectedHousehold: number;
  expectedSavings: number;
  personal: number;
  expected: number;
  paidExpenses: number;
  paidCard: number;
  paidSavings: number;
  paidTotal: number;
  cardToPay: number;
  savingsToDeposit: number;
  /** Positivo: puso de más y recibe; negativo: debe transferir */
  balance: number;
};

export type Transfer = { fromUserId: number; fromName: string; toUserId: number; toName: string; amount: number };

export type MonthClosing = {
  cycle: { start: string; end: string; label: string; cutDay?: number; hasEnded: boolean; isCurrent: boolean };
  prevEnd: string;
  nextEnd: string;
  shareSource: FinanceSettings['shareSource'];
  totals: { household: number; personal: number; byCredit: number; savingsGoal: number; savingsDeposited: number; savingsTotal: number };
  pendingCard: number;
  savingsShortfall: number;
  isFinal: boolean;
  members: ClosingMember[];
  cards: CardStatement[];
  transfers: Transfer[];
  closed?: { closedAt: string; closedBy: string; transfers: Transfer[] };
};
