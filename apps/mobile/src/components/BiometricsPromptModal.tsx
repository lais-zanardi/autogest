import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from './Icon';
import { theme as tokens } from '../theme/tokens';

interface BiometricsPromptModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const BiometricsPromptModal: React.FC<BiometricsPromptModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon name="Fingerprint" size={32} color={tokens.colors.accent} />
          </View>

          <Text style={styles.title}>Ativar Desbloqueio por Biometria?</Text>

          <Text style={styles.description}>
            Acesse o AutoGest de forma rápida e segura utilizando o sensor biométrico do seu
            dispositivo para proteger seus dados e histórico.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={onAccept} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Ativar Biometria</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onDecline} activeOpacity={0.7}>
            <Text style={styles.secondaryButtonText}>Agora não</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.limeDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.lime,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
});
