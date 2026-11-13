import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { useSession } from '../state/SessionProvider';
import { useTheme } from '../theme';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ChooseHouseholdScreen } from '../screens/household/ChooseHouseholdScreen';
import { CreateHouseholdScreen } from '../screens/household/CreateHouseholdScreen';
import { JoinHouseholdScreen } from '../screens/household/JoinHouseholdScreen';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { DesignPreview } from '../screens/DesignPreview';
import { AddIncomeScreen } from '../screens/forms/AddIncomeScreen';
import { AddIncomeSourceScreen } from '../screens/forms/AddIncomeSourceScreen';
import { AddObligationScreen } from '../screens/forms/AddObligationScreen';
import { AddRoutineScreen } from '../screens/forms/AddRoutineScreen';
import { EditIncomeScreen } from '../screens/forms/EditIncomeScreen';
import { EditTaskScreen } from '../screens/forms/EditTaskScreen';
import { ObligationDetailScreen } from '../screens/ObligationDetailScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Tres etapas según la sesión:
 * 1. Sin usuario: bienvenida, registro e ingreso.
 * 2. Con usuario y sin hogar: elegir, crear o unirse a un hogar.
 * 3. Con hogar: las cuatro pestañas y los modales.
 */
export function RootNavigator() {
  const t = useTheme();
  const { restoring, user, household } = useSession();

  const navTheme = useMemo<NavTheme>(() => {
    const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.colors.primary,
        background: t.colors.background,
        card: t.colors.surface,
        text: t.colors.text,
        border: t.colors.border,
        notification: t.colors.danger,
      },
    };
  }, [t]);

  // Mientras se lee la sesión guardada no se muestra nada (es un instante).
  if (restoring) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: t.colors.background },
          headerTintColor: t.colors.primary,
          headerTitleStyle: { fontFamily: t.fontFamily.bold, color: t.colors.text },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: t.colors.background },
        }}
      >
        {!user ? (
          <Stack.Group>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Ingresar' }} />
          </Stack.Group>
        ) : !household ? (
          <Stack.Group>
            <Stack.Screen name="ChooseHousehold" component={ChooseHouseholdScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreateHousehold" component={CreateHouseholdScreen} options={{ title: 'Crear hogar' }} />
            <Stack.Screen name="JoinHousehold" component={JoinHouseholdScreen} options={{ title: 'Unirme a un hogar' }} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={({ route }) => ({ title: route.params?.expenseId ? 'Editar gasto' : 'Nuevo gasto', presentation: 'modal' })} />
            <Stack.Screen name="AddObligation" component={AddObligationScreen} options={({ route }) => ({ title: route.params?.obligationId ? 'Editar cuenta' : 'Nueva cuenta', presentation: 'modal' })} />
            <Stack.Screen name="ObligationDetail" component={ObligationDetailScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="AddIncomeSource" component={AddIncomeSourceScreen} options={({ route }) => ({ title: route.params?.source ? 'Editar fuente' : 'Nueva fuente de ingreso', presentation: 'modal' })} />
            <Stack.Screen name="AddIncome" component={AddIncomeScreen} options={{ title: 'Anotar ingreso', presentation: 'modal' }} />
            <Stack.Screen name="EditIncome" component={EditIncomeScreen} options={{ title: 'Editar ingreso', presentation: 'modal' }} />
            <Stack.Screen name="AddRoutine" component={AddRoutineScreen} options={({ route }) => ({ title: route.params?.routine ? 'Editar rutina' : 'Nueva rutina', presentation: 'modal' })} />
            <Stack.Screen name="EditTask" component={EditTaskScreen} options={{ title: 'Editar tarea', presentation: 'modal' }} />
            <Stack.Screen name="DesignPreview" component={DesignPreview} options={{ title: 'Sistema de diseño' }} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
