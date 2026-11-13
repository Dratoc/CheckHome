import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppFonts } from './src/theme';
import { DesignPreview } from './src/screens/DesignPreview';

export default function App() {
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DesignPreview />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
