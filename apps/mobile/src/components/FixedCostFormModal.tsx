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
  ScrollView,
} from 'react-native';
import { Vehicle, FixedCost } from '@autogest/shared-types';
import { FixedCostService, validateFixedCostForm } from '../services/fixedCostService';
import { colors, spacing, radius, typography } from '../theme';

interface FixedCostFormModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  fixedCostToEdit?: FixedCost | null;
  onClose: () => void;
  onSuccess?: (fixedCost: FixedCost) => void;
}

export const FixedCostFormModal: React.FC<FixedCostFormModalProps> = ({
  visible,
  vehicle,
  fixedCostToEdit,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!fixedCostToEdit;

  const [description, setDescription] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setErrors({});
      setSubmitError(null);
      setIsSubmitting(false);

      if (fixedCostToEdit) {
        setDescription(fixedCostToEdit.description);
        setMonthlyAmount(
          fixedCostToEdit.monthlyAmount
            ? String(fixedCostToEdit.monthlyAmount).replace('.', ',')
            : '',
        );
      } else {
        setDescription('');
        setMonthlyAmount('');
      }
    }
  }, [visible, fixedCostToEdit]);

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9,.]/g, '');
    setMonthlyAmount(cleaned);
    if (errors.monthlyAmount) {
      setErrors(prev => ({ ...prev, monthlyAmount: '' }));
    }
  };

  const handleSave = async () => {
    if (!vehicle) return;
    setSubmitError(null);

    const validation = validateFixedCostForm({
      vehicleId: vehicle.id,
      description,
      monthlyAmount,
    });

    if (!validation.isValid || !validation.data) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      let saved: FixedCost;
      if (isEditing && fixedCostToEdit) {
        saved = await FixedCostService.updateFixedCost(fixedCostToEdit.id, {
          description: validation.data.description,
          monthlyAmount: validation.data.monthlyAmount,
        });
      } else {
        saved = await FixedCostService.createFixedCost({
          vehicleId: vehicle.id,
          description: validation.data.description,
          monthlyAmount: validation.data.monthlyAmount,
        });
      }

      if (onSuccess) {
        onSuccess(saved);
      }
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Erro ao salvar custo fixo.');
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
              <Text style={styles.eyebrow}>CUSTO FIXO MENSAL</Text>
              <Text style={styles.title}>
                {isEditing ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Ficha Resumida do Veículo */}
          <View style={styles.vehicleSummary}>
            <Text style={styles.vehicleModel}>{vehicle.model}</Text>
            <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formBody}>
            {/* Descrição */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Descrição *</Text>
              <TextInput
                style={[styles.input, !!errors.description && styles.inputError]}
                value={description}
                onChangeText={t => {
                  setDescription(t);
                  if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                }}
                placeholder="Ex: Seguro Mensal, Estacionamento, Rastreador"
                placeholderTextColor={colors.textMuted}
                editable={!isSubmitting}
              />
              {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            </View>

            {/* Valor Mensal (R$) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Valor Mensal (R$) *</Text>
              <TextInput
                style={[styles.input, !!errors.monthlyAmount && styles.inputError]}
                value={monthlyAmount}
                onChangeText={handleAmountChange}
                placeholder="Ex: 300,00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                editable={!isSubmitting}
              />
              {errors.monthlyAmount && <Text style={styles.errorText}>{errors.monthlyAmount}</Text>}
              <Text style={styles.hintText}>
                💡 Custos fixos mensais integram automaticamente o cálculo de Custo/Km (valor cheio
                no mês ou proporcional aos dias em outros períodos).
              </Text>
            </View>

            {submitError && <Text style={styles.globalErrorText}>{submitError}</Text>}
          </ScrollView>

          {/* Botões */}
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
                <Text style={styles.saveBtnText}>
                  {isEditing ? 'Salvar Alterações' : 'Cadastrar Custo Fixo'}
                </Text>
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
    maxWidth: 440,
    maxHeight: '90%',
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
    marginBottom: spacing.sm,
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
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
  },
  vehicleModel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  vehiclePlate: {
    ...typography.captionBold,
    color: colors.lime,
    letterSpacing: 0.5,
  },
  formBody: {
    paddingBottom: spacing.sm,
  },
  fieldGroup: {
    marginBottom: spacing.md,
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
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
    lineHeight: 15,
  },
  globalErrorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
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
