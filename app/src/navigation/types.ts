import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
  AddExpense: undefined;
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
