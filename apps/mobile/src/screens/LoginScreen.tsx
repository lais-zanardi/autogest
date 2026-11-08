import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { validateLoginForm } from '../services/authValidation';
import { AuthService } from '../services/authService';
import { BiometricService } from '../services/biometricService';
import { EnvConfig } from '../config/env';
import { useAppStore } from '../store/useAppStore';
import { BiometricsPromptModal } from '../components/BiometricsPromptModal';
import { Icon } from '../components/Icon';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigateToRegister }) => {
  const { setAuth } = useAppStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modo Mock (VITE_USE_MOCK)
  const [isMockMode, setIsMockMode] = useState<boolean>(EnvConfig.isMockMode());

  // Biometria
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [showBiometricsModal, setShowBiometricsModal] = useState(false);

  // Recuperação de senha
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    checkBiometrics();
    setIsMockMode(EnvConfig.isMockMode());
  }, []);

  const checkBiometrics = async () => {
    const isEnabled = await BiometricService.isBiometricsEnabled();
    const sensor = await BiometricService.isSensorAvailable();
    if (isEnabled && sensor.available) {
      setCanUseBiometrics(true);
    }
  };

  const toggleMockMode = async () => {
    const newMode = !isMockMode;
    await EnvConfig.setMockMode(newMode);
    setIsMockMode(newMode);
  };

  const fillTestData = () => {
    setEmail('motorista@autogest.com');
    setPassword('123456');
    setErrors({});
    setGeneralError(null);
  };

  const handleLogin = async () => {
    setGeneralError(null);
    const validation = validateLoginForm(email, password);
    setErrors(validation.errors);

    if (!validation.isValid) {
      return;
    }

    setIsLoading(true);
    try {
      const session = await AuthService.login(email.trim(), password);

      // Verifica se deve oferecer biometria após primeiro login (US01.3)
      const sensor = await BiometricService.isSensorAvailable();
      const alreadyPrompted = await BiometricService.hasPromptedBiometrics();

      if (sensor.available && !alreadyPrompted) {
        setShowBiometricsModal(true);
      } else {
        setAuth(session.user, true);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setGeneralError(null);
    const result = await BiometricService.authenticateWithBiometrics({
      promptMessage: 'Acesse sua conta AutoGest',
      fallbackToPassword: true,
    });

    if (result.success) {
      const session = await AuthService.getStoredSession();
      if (session) {
        setAuth(session.user, true);
      } else {
        setGeneralError('Sessão expirada. Entre com seu e-mail e senha.');
      }
    } else if (result.error) {
      setGeneralError(result.error);
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

  const handleSendPasswordReset = async () => {
    if (!forgotEmail || !forgotEmail.includes('@')) {
      return;
    }
    await AuthService.sendPasswordResetEmail(forgotEmail.trim());
    setForgotSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header / Editorial Brand */}
        <View style={styles.header}>
          <Text style={styles.brandTitle}>AutoGest</Text>
          <Text style={styles.brandSubtitle}>Gestão Veicular & Inteligência Financeira</Text>

          {/* Badge de Chaveamento Mock vs API Real */}
          <TouchableOpacity
            style={[styles.envBadge, isMockMode ? styles.envBadgeMock : styles.envBadgeReal, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
            onPress={toggleMockMode}
            activeOpacity={0.8}
          >
            <Icon
              name={isMockMode ? 'Zap' : 'Globe'}
              size={13}
              color={isMockMode ? colors.black : colors.lime}
            />
            <Text style={styles.envBadgeText}>
              {isMockMode
                ? 'VITE_USE_MOCK: ATIVO (Simulado)'
                : 'VITE_USE_MOCK: INATIVO (API Real)'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Entrar na conta</Text>
            {isMockMode && (
              <TouchableOpacity onPress={fillTestData} activeOpacity={0.7}>
                <Text style={styles.fillTestButtonText}>Preencher Teste</Text>
              </TouchableOpacity>
            )}
          </View>

          {generalError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          )}

          {/* Campo de E-mail */}
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

          {/* Campo de Senha */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>SENHA</Text>
              <TouchableOpacity
                onPress={() => {
                  setForgotSent(false);
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
              >
                <Text style={styles.forgotPasswordLink}>Esqueceu?</Text>
              </TouchableOpacity>
            </View>
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

          {/* Botão Entrar */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading ? styles.buttonDisabled : null]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.submitButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          {/* Desbloqueio com Biometria se disponível */}
          {canUseBiometrics && (
            <TouchableOpacity
              style={[styles.biometricButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
              onPress={handleBiometricLogin}
              activeOpacity={0.8}
            >
              <Icon name="Fingerprint" size={16} color={colors.lime} />
              <Text style={styles.biometricButtonText}>Entrar com Biometria</Text>
            </TouchableOpacity>
          )}

          {/* Criar Conta */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Não possui conta?</Text>
            <TouchableOpacity onPress={onNavigateToRegister} activeOpacity={0.7}>
              <Text style={styles.registerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Recuperação de Senha */}
      <Modal visible={showForgotModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recuperar Senha</Text>
            {forgotSent ? (
              <>
                <Text style={styles.modalDescription}>
                  Se este e-mail estiver cadastrado, você receberá um link com instruções para
                  redefinir sua senha.
                </Text>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={styles.modalPrimaryButtonText}>Entendido</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalDescription}>
                  Informe seu e-mail cadastrado para enviarmos o link de recuperação.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                />
                <TouchableOpacity
                  style={[styles.modalPrimaryButton, { marginTop: spacing.md }]}
                  onPress={handleSendPasswordReset}
                >
                  <Text style={styles.modalPrimaryButtonText}>Enviar Link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

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
  envBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  envBadgeMock: {
    backgroundColor: 'rgba(198, 255, 77, 0.1)',
    borderColor: colors.lime,
  },
  envBadgeReal: {
    backgroundColor: 'rgba(245, 200, 66, 0.1)',
    borderColor: colors.amber,
  },
  envBadgeText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  fillTestButtonText: {
    ...typography.captionBold,
    color: colors.lime,
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
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  forgotPasswordLink: {
    ...typography.caption,
    color: colors.lime,
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
  biometricButton: {
    backgroundColor: colors.limeDim,
    borderWidth: 1,
    borderColor: colors.lime,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  biometricButtonText: {
    ...typography.bodyBold,
    color: colors.lime,
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
  registerLink: {
    ...typography.bodyBold,
    color: colors.lime,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  modalPrimaryButton: {
    backgroundColor: colors.lime,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
});
