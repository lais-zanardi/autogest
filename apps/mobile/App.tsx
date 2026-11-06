import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider, theme } from './src/theme';
import { RootNavigator } from './src/navigation';
import { initDatabase } from './src/database';
import { SyncService } from './src/services/sync';
import { NotificacaoService } from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    initDatabase();
    SyncService.init();
    NotificacaoService.reconciliarAoAbrirApp().catch(err => {
      console.warn('Erro ao reconciliar agendamentos ao abrir o app:', err);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: theme.colors.lime,
              background: theme.colors.background,
              card: theme.colors.surface,
              text: theme.colors.textPrimary,
              border: theme.colors.border,
              notification: theme.colors.amber,
            },
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
