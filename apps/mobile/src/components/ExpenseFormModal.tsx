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
import {
  Vehicle,
  Expense,
  ExpenseCategory,
  TripSubtype,
  MANUAL_EXPENSE_CATEGORIES,
} from '@autogest/shared-types';
import { ExpenseService } from '../services/expenseService';
import { TripService } from '../services/tripService';
import { validateExpenseForm } from '../services/expenseValidation';
import { colors, spacing, radius, typography } from '../theme';
import { TagSelector } from './TagSelector';
import { TagService } from '../services/tagService';

interface ExpenseFormModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  expenseToEdit?: Expense | null;
  onClose: () => void;
  onSuccess?: (expense: Expense) => void;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  visible,
  vehicle,
  expenseToEdit,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!expenseToEdit;

  const [category, setCategory] = useState<ExpenseCategory>('Lavagem');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // US07.3: Vínculo à viagem ativa e escolha de subtipo
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [linkToTrip, setLinkToTrip] = useState(true);
  const [subtipoViagem, setSubtipoViagem] = useState<TripSubtype>('outros');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setErrors({});
      setSubmitError(null);
      setIsSubmitting(false);

      if (expenseToEdit) {
        setCategory(expenseToEdit.category);
        setAmount(expenseToEdit.amount ? String(expenseToEdit.amount).replace('.', ',') : '');
        const d = new Date(expenseToEdit.date);
        setDate(d.toISOString().split('T')[0]);
        setDescription(expenseToEdit.description || '');
        setSubtipoViagem(expenseToEdit.subtipoViagem || (expenseToEdit as any).subtipo_viagem || 'outros');
        setLinkToTrip(!!expenseToEdit.tripId);
        TagService.listarEtiquetasDoRegistro('despesa', expenseToEdit.id)
          .then(tags => setSelectedTagIds(tags.map(t => t.id)))
          .catch(() => setSelectedTagIds([]));
      } else {
        setCategory('Lavagem');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setDescription('');
        setSelectedTagIds([]);
        setSubtipoViagem('outros');
      }

      if (vehicle?.id) {
        TripService.obterViagemAtiva(vehicle.id)
          .then(trip => {
            setActiveTrip(trip);
            if (!expenseToEdit) setLinkToTrip(!!trip);
          })
          .catch(() => setActiveTrip(null));
      } else {
        setActiveTrip(null);
      }
    }
  }, [visible, expenseToEdit, vehicle]);

  const handleAmountChange = (text: string) => {
    // Permite dígitos e apenas uma vírgula ou ponto
    const cleaned = text.replace(/[^0-9,.]/g, '');
    setAmount(cleaned);
    if (errors.amount) {
      setErrors(prev => ({ ...prev, amount: '' }));
    }
  };

  const handleSave = async () => {
    if (!vehicle) return;
    setSubmitError(null);

    const validation = validateExpenseForm({
      vehicleId: vehicle.id,
      category,
      amount,
      date,
      description,
    });

    if (!validation.isValid || !validation.data) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      let saved: Expense;
      if (isEditing && expenseToEdit) {
        saved = await ExpenseService.updateExpense(expenseToEdit.id, {
          category: validation.data.category,
          amount: validation.data.amount,
          date: validation.data.date,
          description: validation.data.description,
          tripId: linkToTrip && activeTrip ? activeTrip.id : null,
          viagem_id: linkToTrip && activeTrip ? activeTrip.id : null,
          subtipoViagem: linkToTrip && activeTrip ? subtipoViagem : null,
          subtipo_viagem: linkToTrip && activeTrip ? subtipoViagem : null,
        });
      } else {
        saved = await ExpenseService.createExpense({
          vehicleId: vehicle.id,
          category: validation.data.category,
          amount: validation.data.amount,
          date: validation.data.date,
          description: validation.data.description,
          tripId: linkToTrip && activeTrip ? activeTrip.id : null,
          viagem_id: linkToTrip && activeTrip ? activeTrip.id : null,
          subtipoViagem: linkToTrip && activeTrip ? subtipoViagem : null,
          subtipo_viagem: linkToTrip && activeTrip ? subtipoViagem : null,
        });
      }

      if (saved?.id) {
        await TagService.vincularEtiquetas('despesa', saved.id, selectedTagIds);
      }

      if (onSuccess) {
        onSuccess(saved);
      }
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Erro ao salvar despesa.');
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
              <Text style={styles.eyebrow}>FINANCEIRO</Text>
              <Text style={styles.title}>{isEditing ? 'Editar Despesa' : 'Nova Despesa'}</Text>
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
            {/* US07.3: Vínculo à Viagem Ativa e Subtipo */}
            {activeTrip && (
              <View style={{ backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ ...typography.bodyBold, color: colors.lime }}>
                      🛣️ Viagem em andamento
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                      {activeTrip.origin} ➔ {activeTrip.destination}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setLinkToTrip(!linkToTrip)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                      backgroundColor: linkToTrip ? colors.lime : colors.surface,
                    }}
                  >
                    <Text style={{ ...typography.caption, color: linkToTrip ? colors.black : colors.textSecondary, fontWeight: '700' }}>
                      {linkToTrip ? 'Vinculada' : 'Não vincular'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {linkToTrip && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[styles.label, { fontSize: 12 }]}>Subtipo da Viagem</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {(
                        [
                          { key: 'pedagio', label: '🛣️ Pedágio' },
                          { key: 'alimentacao', label: '🍔 Alimentação' },
                          { key: 'hospedagem', label: '🏨 Hospedagem' },
                          { key: 'estacionamento', label: '🅿️ Estacionamento' },
                          { key: 'outros', label: 'Outros' },
                        ] as Array<{ key: TripSubtype; label: string }>
                      ).map(sub => {
                        const isSelected = subtipoViagem === sub.key;
                        return (
                          <TouchableOpacity
                            key={sub.key}
                            style={[
                              styles.categoryChip,
                              isSelected && styles.categoryChipSelected,
                              { paddingHorizontal: 10, paddingVertical: 4 },
                            ]}
                            onPress={() => setSubtipoViagem(sub.key)}
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                isSelected && styles.categoryChipTextSelected,
                                { fontSize: 11 },
                              ]}
                            >
                              {sub.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Seletor de Categoria Manual (US22.2) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Categoria *</Text>
              <View style={styles.categoryRow}>
                {MANUAL_EXPENSE_CATEGORIES.map(cat => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                      onPress={() => setCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
              <Text style={styles.hintText}>
                💡 Pedágio entra em Outros. Gastos com Combustível e Manutenção entram
                automaticamente por seus módulos.
              </Text>
            </View>

            {/* Valor (R$) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Valor (R$) *</Text>
              <TextInput
                style={[styles.input, !!errors.amount && styles.inputError]}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="Ex: 50,00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                editable={!isSubmitting}
              />
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
            </View>

            {/* Data */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Data *</Text>
              <TextInput
                style={[styles.input, !!errors.date && styles.inputError]}
                value={date}
                onChangeText={t => {
                  setDate(t);
                  if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.textMuted}
                editable={!isSubmitting}
              />
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            {/* Descrição Opcional */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex: Lavagem completa com cera / Pedágio rodovia"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                editable={!isSubmitting}
              />
            </View>

            {/* US27.3: Etiquetas com autocomplete e criação */}
            <TagSelector
              selectedTagIds={selectedTagIds}
              onChangeSelectedTagIds={setSelectedTagIds}
            />

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
                  {isEditing ? 'Salvar Alterações' : 'Registrar Despesa'}
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
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  categoryChipSelected: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  categoryChipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: colors.black,
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
  textArea: {
    minHeight: 56,
    textAlignVertical: 'top',
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
