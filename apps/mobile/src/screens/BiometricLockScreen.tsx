import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { BiometricService } from '../services/biometricService';
import { useAppStore } from '../store/useAppStore';
import { AuthService } from '../services/authService';

interface BiometricLockScreenProps {
  onFallbackToPassword: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({
  onFallbackToPassword,
}) => {
  const { user, setBiometricsLocked } = useAppStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    promptBiometric();
  }, []);

  const promptBiometric = async () => {
    setIsVerifying(true);
    setErrorMessage(null);

    const result = await BiometricService.authenticateWithBiometrics({
      promptMessage: 'Desbloquear AutoGest com biometria',
      fallbackToPassword: true,
    });

    setIsVerifying(false);

    if (result.success) {
      setBiometricsLocked(false);
    } else {
      if (result.fallbackRequired) {
        setErrorMessage(
          result.error || 'Não foi possível reconhecer a biometria. Use seu e-mail e senha.',
        );
      }
    }
  };

  const handleUsePassword = async () => {
    // US01.4: se falhar ou não houver biometria, cai para e-mail e senha
    await AuthService.logout();
    onFallbackToPassword();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>AutoGest</Text>
          <Text style={styles.brandSubtitle}>Aplicativo Bloqueado por Biometria</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🔒</Text>
          </View>

          <Text style={styles.userName}>Olá, {user?.name || 'Motorista'}</Text>
          <Text style={styles.instruction}>
            Toque no sensor biométrico do seu celular para acessar sua garagem e registros.
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.retryButton}
            onPress={promptBiometric}
            disabled={isVerifying}
            activeOpacity={0.8}
          >
            {isVerifying ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.retryButtonText}>👆 Tocar no Sensor</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={handleUsePassword}
            activeOpacity={0.7}
          >
            <Text style={styles.fallbackButtonText}>Entrar com E-mail e Senha</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandTitle: {
    ...typography.hero,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  brandSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.limeDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  userName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  instruction: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: 'rgba(224, 90, 90, 0.15)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    width: '100%',
    backgroundColor: colors.lime,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  retryButtonText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
  fallbackButton: {
    paddingVertical: spacing.sm,
  },
  fallbackButtonText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
});
