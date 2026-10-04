import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Vehicle } from '@autogest/shared-types';
import { OdometerService } from '../services/odometerService';
import { validarNovoKm } from '../services/fuelingCalculations';
import { parseDecimalInput } from '../services/vehicleValidation';
import { colors, spacing, radius, typography } from '../theme';

interface UpdateOdometerModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSuccess?: (newKm: number) => void;
}

export const UpdateOdometerModal: React.FC<UpdateOdometerModalProps> = ({
  visible,
  vehicle,
  onClose,
  onSuccess,
}) => {
  const [kmInput, setKmInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentKm = vehicle?.currentOdometer ?? vehicle?.initialOdometer ?? 0;

  useEffect(() => {
    if (visible) {
      setKmInput('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [visible, vehicle]);

  const handleKmChange = (text: string) => {
    // Permite dígitos, vírgula e ponto
    const cleaned = text.replace(/[^0-9,.]/g, '');
    setKmInput(cleaned);

    if (error && cleaned) {
      const num = parseDecimalInput(cleaned);
      if (num !== null) {
        const validation = validarNovoKm(num, currentKm);
        if (validation.isValid) {
          setError(null);
        }
      }
    }
  };

  const handleQuickAdd = (increment: number) => {
    const target = currentKm + increment;
    setKmInput(String(target));
    setError(null);
  };

  const handleSave = async () => {
    if (!vehicle) return;

    const numKm = parseDecimalInput(kmInput);
    if (!kmInput || numKm === null || isNaN(numKm)) {
      setError('Por favor, informe a nova quilometragem.');
      return;
    }

    // US06.2: Validação com validarNovoKm
    const validation = validarNovoKm(numKm, currentKm);
    if (!validation.isValid) {
      setError(validation.error || 'Quilometragem inválida.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // US06.3: Grava leitura e atualiza veículo
      const reading = await OdometerService.updateManualOdometer(vehicle.id, numKm);
      if (onSuccess) {
        onSuccess(reading.km);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar quilometragem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>HODÔMETRO</Text>
              <Text style={styles.title}>Atualizar Quilometragem</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Ficha resumida do veículo */}
          <View style={styles.vehicleSummary}>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleModel}>{vehicle.model}</Text>
              <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>
            </View>
            <View style={styles.odometerChip}>
              <Text style={styles.odometerChipLabel}>Último consolidado</Text>
              <Text style={styles.odometerChipValue}>{currentKm.toLocaleString('pt-BR')} km</Text>
            </View>
          </View>

          {/* Campo de Entrada */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nova Quilometragem (km) *</Text>
            <TextInput
              style={[styles.input, !!error && styles.inputError]}
              value={kmInput}
              onChangeText={handleKmChange}
              placeholder={`Ex: ${(currentKm + 100).toLocaleString('pt-BR')}`}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
              editable={!isSubmitting}
            />

            {/* Chips de acréscimo rápido */}
            <View style={styles.quickAddRow}>
              <Text style={styles.quickAddLabel}>Sugestões:</Text>
              {[50, 100, 250, 500].map(inc => (
                <TouchableOpacity
                  key={inc}
                  style={styles.quickAddChip}
                  onPress={() => handleQuickAdd(inc)}
                  activeOpacity={0.7}
                  disabled={isSubmitting}
                >
                  <Text style={styles.quickAddChipText}>+{inc} km</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mensagem de Erro (US06.2) */}
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.hintText}>
              A nova quilometragem deve ser estritamente superior ao valor consolidado anterior (
              {currentKm.toLocaleString('pt-BR')} km).
            </Text>
          </View>

          {/* Botões de Ação */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Salvar Quilometragem</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 7, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.lime,
    marginBottom: 2,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  vehicleSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.lg,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleModel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  vehiclePlate: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  odometerChip: {
    alignItems: 'flex-end',
  },
  odometerChipLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  odometerChipValue: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 13,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  inputError: {
    borderColor: colors.error,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  quickAddLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginRight: 2,
  },
  quickAddChip: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quickAddChipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  cancelBtnText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: colors.lime,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: colors.black,
  },
});
