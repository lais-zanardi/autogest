import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { validateRegisterForm } from '../services/authValidation';
import { AuthService } from '../services/authService';
import { BiometricService } from '../services/biometricService';
import { useAppStore } from '../store/useAppStore';
import { BiometricsPromptModal } from '../components/BiometricsPromptModal';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigateToLogin }) => {
  const { setAuth } = useAppStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricsModal, setShowBiometricsModal] = useState(false);

  const handleRegister = async () => {
    setGeneralError(null);
    const validation = validateRegisterForm(name, email, password, confirmPassword);
    setErrors(validation.errors);

    if (!validation.isValid) {
      return;
    }

    setIsLoading(true);
    try {
      const session = await AuthService.register(name.trim(), email.trim(), password);

      const sensor = await BiometricService.isSensorAvailable();
      const alreadyPrompted = await BiometricService.hasPromptedBiometrics();

      if (sensor.available && !alreadyPrompted) {
        setShowBiometricsModal(true);
      } else {
        setAuth(session.user, true);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Falha ao realizar cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptBiometrics = async () => {
    await BiometricService.setBiometricsEnabled(true);
    await BiometricService.markBiometricsPrompted();
    setShowBiometricsModal(false);
    const session = await AuthService.getStoredSession();
    if (session) {
      setAuth(session.user, true);
    }
  };

  const handleDeclineBiometrics = async () => {
    await BiometricService.setBiometricsEnabled(false);
    await BiometricService.markBiometricsPrompted();
    setShowBiometricsModal(false);
    const session = await AuthService.getStoredSession();
    if (session) {
      setAuth(session.user, true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brandTitle}>AutoGest</Text>
          <Text style={styles.brandSubtitle}>Crie sua conta para começar</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Novo Cadastro</Text>

          {generalError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          )}

          {/* Nome */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOME COMPLETO</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="Ex.: Laís Zanardi"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={text => {
                setName(text);
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
            />
            {errors.name ? <Text style={styles.fieldErrorText}>{errors.name}</Text> : null}
          </View>

          {/* E-mail */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-MAIL</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={text => {
                setEmail(text);
                if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
              }}
            />
            {errors.email ? <Text style={styles.fieldErrorText}>{errors.email}</Text> : null}
          </View>

          {/* Senha */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SENHA</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  errors.password ? styles.inputError : null,
                ]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={text => {
                  setPassword(text);
                  if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                }}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(prev => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeButtonText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.fieldErrorText}>{errors.password}</Text> : null}
          </View>

          {/* Confirmação de Senha */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONFIRMAR SENHA</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Repita sua senha"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={text => {
                setConfirmPassword(text);
                if (errors.confirmPassword) {
                  setErrors(prev => ({ ...prev, confirmPassword: '' }));
                }
              }}
            />
            {errors.confirmPassword ? (
              <Text style={styles.fieldErrorText}>{errors.confirmPassword}</Text>
            ) : null}
          </View>

          {/* Botão Cadastrar */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading ? styles.buttonDisabled : null]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.submitButtonText}>Cadastrar e Começar</Text>
            )}
          </TouchableOpacity>

          {/* Link para Login */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Já tem uma conta?</Text>
            <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Fazer Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Oferta de Biometria (US01.3) */}
      <BiometricsPromptModal
        visible={showBiometricsModal}
        onAccept={handleAcceptBiometrics}
        onDecline={handleDeclineBiometrics}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: 'rgba(224, 90, 90, 0.15)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.body,
    color: colors.error,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 70,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  eyeButtonText: {
    ...typography.captionBold,
    color: colors.lime,
  },
  inputError: {
    borderColor: colors.error,
  },
  fieldErrorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  submitButton: {
    backgroundColor: colors.lime,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  loginLink: {
    ...typography.bodyBold,
    color: colors.lime,
  },
});
