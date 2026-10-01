import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from './types';
import { AppTabs } from './AppTabs';
import { RefuelFormScreen } from '../screens/RefuelFormScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { BiometricLockScreen } from '../screens/BiometricLockScreen';
import { useAppStore } from '../store/useAppStore';
import { AuthService } from '../services/authService';
import { BiometricService } from '../services/biometricService';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const NewFuelingModalScreen: React.FC = () => {
  const navigation = useNavigation();
  return <RefuelFormScreen onClose={() => navigation.goBack()} />;
};

export const RootNavigator: React.FC = () => {
  const {
    isAuthenticated,
    isBiometricsLocked,
    isLoadingAuth,
    setAuth,
    setBiometricsLocked,
    setIsLoadingAuth,
  } = useAppStore();

  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  useEffect(() => {
    bootstrapSession();
  }, []);

  const bootstrapSession = async () => {
    try {
      const session = await AuthService.getStoredSession();
      if (session) {
        setAuth(session.user, true);

        // US01.4: Verifica se o usuário habilitou biometria para exigir desbloqueio ao abrir o app
        const biometricsEnabled = await BiometricService.isBiometricsEnabled();
        if (biometricsEnabled) {
          setBiometricsLocked(true);
        } else {
          setBiometricsLocked(false);
        }
      } else {
        setAuth(null, false);
        setBiometricsLocked(false);
      }
    } catch {
      setAuth(null, false);
      setBiometricsLocked(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Splash de carregamento da sessão
  if (isLoadingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.lime} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // US01.2: Guarda de navegação - Sem sessão vai para Login/Cadastro
        <>
          {authScreen === 'login' ? (
            <Stack.Screen name="Login">
              {() => <LoginScreen onNavigateToRegister={() => setAuthScreen('register')} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Register">
              {() => <RegisterScreen onNavigateToLogin={() => setAuthScreen('login')} />}
            </Stack.Screen>
          )}
        </>
      ) : isBiometricsLocked ? (
        // US01.4: Usuário com sessão persistida mas app bloqueado por biometria
        <Stack.Screen name="BiometricLock">
          {() => (
            <BiometricLockScreen
              onFallbackToPassword={() => {
                setAuth(null, false);
                setBiometricsLocked(false);
                setAuthScreen('login');
              }}
            />
          )}
        </Stack.Screen>
      ) : (
        // Usuário autenticado e desbloqueado: Acesso completo ao app
        <>
          <Stack.Screen name="MainTabs" component={AppTabs} />
          <Stack.Screen
            name="NewFuelingModal"
            component={NewFuelingModalScreen}
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
