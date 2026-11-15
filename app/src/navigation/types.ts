import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Attachment, AttachmentKind, IncomeSource, KeyDate, ObligationKind, PaymentMethod, Pet, Property, Routine, TaskCategory, Vehicle } from '../services/types';

export type TabParamList = {
  Home: undefined;
  Accounts: undefined;
  Tasks: undefined;
  Household: undefined;
};

export type RootStackParamList = {
  // Acceso
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
  // Hogar
  ChooseHousehold: undefined;
  CreateHousehold: undefined;
  JoinHousehold: undefined;
  // App
  Main: NavigatorScreenParams<TabParamList>;
  /** Con expenseId, edita ese gasto */
  AddExpense: { expenseId?: number } | undefined;
  /** Con obligationId, edita esa cuenta; kind, vehicleId y propertyId prellenan una nueva */
  AddObligation: { obligationId?: number; kind?: ObligationKind; vehicleId?: number; propertyId?: number } | undefined;
  ObligationDetail: { obligationId: number; name: string };
  /** Con source, edita esa fuente */
  AddIncomeSource: { source?: IncomeSource; propertyId?: number } | undefined;
  AddIncome: { source: IncomeSource };
  EditIncome: { incomeId: number };
  /** Con routine, edita esa rutina; petId o vehicleId prellenan de quién es una nueva */
  AddRoutine: { routine?: Routine; petId?: number; vehicleId?: number } | undefined;
  EditTask: { taskId: number; title: string; category?: TaskCategory };
  Shopping: undefined;
  // Mascotas y fechas clave
  Pets: undefined;
  Pet: { petId: number; name: string };
  /** Con pet, la edita */
  AddPet: { pet?: Pet } | undefined;
  /** Con keyDate, la edita; si no, crea una para la mascota o el vehículo indicado */
  AddKeyDate: { keyDate?: KeyDate; petId?: number; vehicleId?: number };
  // Patrimonio y deudas
  Vehicles: undefined;
  /** Con vehicle, lo edita */
  AddVehicle: { vehicle?: Vehicle } | undefined;
  Properties: undefined;
  /** Con property, la edita */
  AddProperty: { property?: Property } | undefined;
  Loans: undefined;
  /** Con attachment, lo edita; si no, sube uno nuevo al vehículo, propiedad, mascota o papel indicado */
  AddAttachment: {
    attachment?: Attachment;
    owner?: 'vehicle' | 'property' | 'pet';
    vehicleId?: number;
    propertyId?: number;
    petId?: number;
    obligationId?: number;
    kind?: AttachmentKind;
    title?: string;
    expiresOn?: string;
  };
  // Medios de pago y cierre del mes
  PaymentMethods: undefined;
  /** Con method, lo edita */
  AddPaymentMethod: { method?: PaymentMethod } | undefined;
  /** Sin end, el período en curso */
  CardStatement: { methodId: number; name: string; end?: string };
  /** Débito o efectivo: sus gastos por mes del hogar. Sin end, el mes en curso */
  MethodMovements: { methodId: number; name: string; end?: string };
  PayCard: { methodId: number; name: string; statementEnd: string; label: string; suggested: number };
  /** Sin end, el mes del hogar de hoy */
  Closing: { end?: string } | undefined;
  FinanceSettings: undefined;
  AddSavings: undefined;
  DesignPreview: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
