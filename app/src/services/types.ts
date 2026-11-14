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

/** Vehículo con sus papeles (permiso, revisión técnica, SOAP, seguro) y sus documentos digitales. */
export type VehicleView = Vehicle & { documents: ObligationView[]; attachments: Attachment[] };

export type Property = {
  id: number;
  householdId: number;
  name: string;
  address?: string;
};

/** Propiedad con su dividendo, su arriendo y lo pagado y recibido este mes. */
export type PropertyView = Property & {
  mortgages: ObligationView[];
  attachments: Attachment[];
  rentSources: IncomeSource[];
  rentThisMonth: number;
  mortgagePaidThisMonth: number;
};

export type AttachmentKind =
  | 'circulation_permit'
  | 'technical_review'
  | 'soap'
  | 'insurance'
  | 'registration'
  | 'license'
  | 'deed'
  | 'lease'
  | 'property_tax'
  | 'other';

export type AttachmentContentType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

/** Documento digital (foto o PDF) de un vehículo o propiedad; si es la copia de un papel, obligationId lo liga. */
export type Attachment = {
  id: number;
  householdId: number;
  vehicleId?: number;
  propertyId?: number;
  obligationId?: number;
  kind: AttachmentKind;
  title: string;
  /** YYYY-MM-DD */
  expiresOn?: string;
  daysLeft?: number;
  /** none: sin vencimiento; expires_soon: 30 días o menos */
  status: 'none' | 'ok' | 'expires_soon' | 'expired';
  fileName: string;
  contentType: AttachmentContentType;
  sizeBytes: number;
  uploadedBy: number;
  createdAt: string;
};
