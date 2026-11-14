import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { HomeScreen } from '../screens/tabs/HomeScreen';
import { AccountsScreen } from '../screens/tabs/AccountsScreen';
import { TasksScreen } from '../screens/tabs/TasksScreen';
import { HouseholdScreen } from '../screens/tabs/HouseholdScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const icons: Record<keyof TabParamList, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  Accounts: ['wallet', 'wallet-outline'],
  Tasks: ['checkmark-circle', 'checkmark-circle-outline'],
  Household: ['people', 'people-outline'],
};

/** Las cuatro pestañas del MVP: Inicio, Cuentas, Tareas y Hogar. */
export function MainTabs() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Tareas usa el violeta de puntos; el resto, el color de marca.
        tabBarActiveTintColor: route.name === 'Tasks' ? t.colors.points : t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        // Más alta que la barra por defecto (49) para que la etiqueta con Plus Jakarta no se corte.
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          height: t.sizes.buttonLg + t.spacing.sm + insets.bottom,
          paddingTop: t.spacing.xs,
          paddingBottom: insets.bottom + t.spacing.xs,
        },
        tabBarLabelStyle: { fontFamily: t.fontFamily.semibold, fontSize: 12, lineHeight: 16 },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={icons[route.name][focused ? 0 : 1]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Accounts" component={AccountsScreen} options={{ title: 'Cuentas' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tareas' }} />
      <Tab.Screen name="Household" component={HouseholdScreen} options={{ title: 'Hogar' }} />
    </Tab.Navigator>
  );
}
