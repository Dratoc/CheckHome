import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Attachment, AttachmentKind, IncomeSource, ObligationKind, Property, Routine, Vehicle } from '../services/types';

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
  /** Con routine, edita esa rutina */
  AddRoutine: { routine?: Routine } | undefined;
  EditTask: { taskId: number; title: string };
  // Patrimonio y deudas
  Vehicles: undefined;
  /** Con vehicle, lo edita */
  AddVehicle: { vehicle?: Vehicle } | undefined;
  Properties: undefined;
  /** Con property, la edita */
  AddProperty: { property?: Property } | undefined;
  Loans: undefined;
  /** Con attachment, lo edita; si no, sube uno nuevo al vehículo, propiedad o papel indicado */
  AddAttachment: {
    attachment?: Attachment;
    owner?: 'vehicle' | 'property';
    vehicleId?: number;
    propertyId?: number;
    obligationId?: number;
    kind?: AttachmentKind;
    title?: string;
    expiresOn?: string;
  };
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
