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
  Alert,
} from 'react-native';
import {
  Vehicle,
  Maintenance,
  MaintenanceType,
  MaintenanceServiceType,
  MaintenanceAttachment,
  MaintenanceSchedule,
} from '@autogest/shared-types';
import { MaintenanceService } from '../services/maintenanceService';
import { MaintenanceScheduleService } from '../services/maintenanceScheduleService';
import { AttachmentRepository } from '../repositories/AttachmentRepository';
import { CameraService } from '../services/cameraService';
import { colors, spacing, radius, typography } from '../theme';
import { TagSelector } from './TagSelector';
import { TagService } from '../services/tagService';
import { validarNota, LIMITE_MAXIMO_NOTA } from '../services/routeContextService';

interface MaintenanceFormModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  maintenanceToEdit?: Maintenance | null;
  scheduleToComplete?: MaintenanceSchedule | null;
  onClose: () => void;
  onSuccess?: (maintenance: Maintenance) => void;
}

const SERVICE_TYPE_OPTIONS: Array<{ key: MaintenanceServiceType; label: string; icon: string }> = [
  { key: 'troca_oleo', label: 'Óleo', icon: '🛢️' },
  { key: 'calibragem_pneus', label: 'Calibragem', icon: '💨' },
  { key: 'fluido_freio', label: 'Fluido Freio', icon: '🛑' },
  { key: 'agua_radiador', label: 'Radiador', icon: '💧' },
  { key: 'filtros', label: 'Filtros', icon: '💨' },
  { key: 'correia_dentada', label: 'Correia', icon: '⚙️' },
  { key: 'velas', label: 'Velas', icon: '⚡' },
  { key: 'pneus', label: 'Pneus', icon: '🛞' },
  { key: 'freios', label: 'Freios', icon: '🛑' },
  { key: 'outros', label: 'Outros', icon: '🔧' },
];

export const MaintenanceFormModal: React.FC<MaintenanceFormModalProps> = ({
  visible,
  vehicle,
  maintenanceToEdit,
  scheduleToComplete,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!maintenanceToEdit;

  const [date, setDate] = useState('');
  const [km, setKm] = useState('');
  const [type, setType] = useState<MaintenanceType>('preventiva');
  const [serviceType, setServiceType] = useState<MaintenanceServiceType>('troca_oleo');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [replacedParts, setReplacedParts] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [mechanic, setMechanic] = useState('');
  const [executionTimeMin, setExecutionTimeMin] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [attachments, setAttachments] = useState<MaintenanceAttachment[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setErrors({});
      setSubmitError(null);
      setIsSubmitting(false);

      if (maintenanceToEdit) {
        setDate(maintenanceToEdit.date);
        setKm(String(maintenanceToEdit.odometer));
        setType(maintenanceToEdit.type);
        setServiceType(maintenanceToEdit.serviceType);
        setAmount(
          maintenanceToEdit.totalValue
            ? String(maintenanceToEdit.totalValue).replace('.', ',')
            : '',
        );
        setDescription(maintenanceToEdit.description || '');
        setReplacedParts(maintenanceToEdit.replacedParts || '');
        setWorkshop(maintenanceToEdit.workshop || '');
        setMechanic(maintenanceToEdit.mechanic || '');
        setExecutionTimeMin(
          maintenanceToEdit.executionTimeMin ? String(maintenanceToEdit.executionTimeMin) : '',
        );
        setNotes(maintenanceToEdit.notes || maintenanceToEdit.nota || '');
        setAttachments(maintenanceToEdit.attachments || []);
        TagService.listarEtiquetasDoRegistro('manutencao', maintenanceToEdit.id)
          .then(tags => setSelectedTagIds(tags.map(t => t.id)))
          .catch(() => setSelectedTagIds([]));
      } else if (scheduleToComplete) {
        setDate(scheduleToComplete.date);
        setKm(vehicle?.currentOdometer ? String(vehicle.currentOdometer) : '');
        setType('preventiva');
        setServiceType(scheduleToComplete.serviceType);
        setAmount('');
        setDescription(scheduleToComplete.description || '');
        setReplacedParts('');
        setWorkshop('');
        setMechanic('');
        setExecutionTimeMin('');
        setNotes('');
        setSelectedTagIds([]);
        setAttachments([]);
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setKm(vehicle?.currentOdometer ? String(vehicle.currentOdometer) : '');
        setType('preventiva');
        setServiceType('troca_oleo');
        setAmount('');
        setDescription('');
        setReplacedParts('');
        setWorkshop('');
        setMechanic('');
        setExecutionTimeMin('');
        setNotes('');
        setSelectedTagIds([]);
        setAttachments([]);
      }
    }
  }, [visible, maintenanceToEdit, scheduleToComplete, vehicle]);

  const handlePickAttachment = async (source: 'camera' | 'gallery') => {
    try {
      const result = await CameraService.pickMaintenanceImage(source);
      if (!result) return;

      // Valida limite de 1 MB
      const validated = await MaintenanceService.validateAndPrepareAttachment({
        localPath: result.uri,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });

      // Cria registro de anexo com status 'pendente'
      const savedAttachment = await AttachmentRepository.create({
        localPath: validated.localPath,
        fileSize: validated.fileSize,
        mimeType: validated.mimeType,
        uploadStatus: 'pendente',
      });

      setAttachments(prev => [...prev, savedAttachment]);
    } catch (err: any) {
      Alert.alert('Atenção', err?.message || 'Falha ao selecionar imagem.');
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSave = async () => {
    if (!vehicle) {
      setSubmitError('Nenhum veículo selecionado.');
      return;
    }

    const newErrors: Record<string, string> = {};
    if (!date.trim()) newErrors.date = 'Data é obrigatória.';
    if (!km.trim()) newErrors.km = 'Quilometragem é obrigatória.';
    if (!amount.trim()) newErrors.amount = 'Valor é obrigatório.';
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória.';

    const numericKm = Number(km.replace(',', '.'));
    if (isNaN(numericKm) || numericKm < 0) {
      newErrors.km = 'Quilometragem inválida.';
    }

    const numericAmount = Number(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount < 0) {
      newErrors.amount = 'Valor inválido.';
    }

    const validacaoNota = validarNota(notes);
    if (!validacaoNota.isValid) {
      newErrors.notes = validacaoNota.error || 'A nota excede 500 caracteres.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const attachmentIds = attachments.map(a => a.id);
      let targetId: string | null = null;

      if (isEditing && maintenanceToEdit) {
        const updated = await MaintenanceService.updateMaintenance(maintenanceToEdit.id, {
          date: date.trim(),
          odometer: numericKm,
          type,
          serviceType,
          description: description.trim(),
          replacedParts: replacedParts.trim() || null,
          workshop: workshop.trim() || null,
          mechanic: mechanic.trim() || null,
          executionTimeMin: executionTimeMin.trim() ? Number(executionTimeMin) : null,
          totalValue: numericAmount,
          notes: notes.trim() || null,
          nota: notes.trim() || null,
          attachmentIds,
        });

        if (updated) {
          targetId = updated.id;
          onSuccess?.(updated);
        }
      } else {
        const created = await MaintenanceService.createMaintenance({
          vehicleId: vehicle.id,
          date: date.trim(),
          odometer: numericKm,
          type,
          serviceType,
          description: description.trim(),
          replacedParts: replacedParts.trim() || null,
          workshop: workshop.trim() || null,
          mechanic: mechanic.trim() || null,
          executionTimeMin: executionTimeMin.trim() ? Number(executionTimeMin) : null,
          totalValue: numericAmount,
          notes: notes.trim() || null,
          nota: notes.trim() || null,
          attachmentIds,
        });

        targetId = created.id;

        if (scheduleToComplete) {
          // US30.5: vincula manutencao_id e marca o agendamento como concluído
          await MaintenanceScheduleService.concluirAgendamento(scheduleToComplete.id, created.id);
        }

        onSuccess?.(created);
      }

      if (targetId) {
        await TagService.vincularEtiquetas('manutencao', targetId, selectedTagIds);
      }

      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Falha ao salvar manutenção.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {isEditing ? 'Editar Manutenção' : 'Nova Manutenção'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {vehicle?.model} • {vehicle?.plate}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {submitError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{submitError}</Text>
              </View>
            )}

            {/* Tipo: Preventiva / Corretiva (US09.2) */}
            <Text style={styles.fieldLabel}>TIPO DE MANUTENÇÃO *</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, type === 'preventiva' && styles.typeOptionSelected]}
                onPress={() => setType('preventiva')}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeText, type === 'preventiva' && styles.typeTextSelected]}>
                  🛡️ Preventiva
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeOption, type === 'corretiva' && styles.typeOptionSelected]}
                onPress={() => setType('corretiva')}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeText, type === 'corretiva' && styles.typeTextSelected]}>
                  ⚠️ Corretiva
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tipo de Serviço (Chips) */}
            <Text style={styles.fieldLabel}>SERVIÇO REALIZADO *</Text>
            <View style={styles.chipsRow}>
              {SERVICE_TYPE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, serviceType === opt.key && styles.chipSelected]}
                  onPress={() => setServiceType(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipIcon}>{opt.icon}</Text>
                  <Text
                    style={[styles.chipText, serviceType === opt.key && styles.chipTextSelected]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Linha Km e Data */}
            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>QUILOMETRAGEM (KM) *</Text>
                <TextInput
                  style={[styles.input, errors.km ? styles.inputError : null]}
                  value={km}
                  onChangeText={setKm}
                  placeholder="Ex: 45000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
                {errors.km && <Text style={styles.errorText}>{errors.km}</Text>}
              </View>

              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>DATA (AAAA-MM-DD) *</Text>
                <TextInput
                  style={[styles.input, errors.date ? styles.inputError : null]}
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-05-10"
                  placeholderTextColor={colors.textMuted}
                />
                {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
              </View>
            </View>

            {/* Valor */}
            <Text style={styles.fieldLabel}>VALOR TOTAL (R$) *</Text>
            <TextInput
              style={[styles.input, errors.amount ? styles.inputError : null]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

            {/* Descrição */}
            <Text style={styles.fieldLabel}>DESCRIÇÃO DO SERVIÇO *</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description ? styles.inputError : null]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva os reparos ou revisões realizados..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

            {/* Peças Trocadas (US09.2) */}
            <Text style={styles.fieldLabel}>PEÇAS TROCADAS (OPCIONAL)</Text>
            <TextInput
              style={styles.input}
              value={replacedParts}
              onChangeText={setReplacedParts}
              placeholder="Ex: Filtro de óleo, 4L óleo sintético..."
              placeholderTextColor={colors.textMuted}
            />

            {/* Oficina e Profissional */}
            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>OFICINA / MECÂNICA</Text>
                <TextInput
                  style={styles.input}
                  value={workshop}
                  onChangeText={setWorkshop}
                  placeholder="Nome do local"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>MECÂNICO</Text>
                <TextInput
                  style={styles.input}
                  value={mechanic}
                  onChangeText={setMechanic}
                  placeholder="Profissional"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Tempo de Execução */}
            <Text style={styles.fieldLabel}>TEMPO DE EXECUÇÃO (MINUTOS)</Text>
            <TextInput
              style={styles.input}
              value={executionTimeMin}
              onChangeText={setExecutionTimeMin}
              placeholder="Ex: 60"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            {/* US27.3: Etiquetas com autocomplete e criação */}
            <TagSelector
              selectedTagIds={selectedTagIds}
              onChangeSelectedTagIds={setSelectedTagIds}
            />

            {/* US27.4: Campo de Nota com limite de 500 caracteres */}
            <View style={{ marginVertical: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.fieldLabel}>NOTAS ADICIONAIS (OPCIONAL)</Text>
                <Text style={{ ...typography.caption, color: notes.length > LIMITE_MAXIMO_NOTA ? colors.error : colors.textMuted }}>
                  {notes.length}/{LIMITE_MAXIMO_NOTA}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  { height: 75, textAlignVertical: 'top', paddingTop: 8 },
                  errors.notes ? styles.inputError : null,
                ]}
                multiline
                maxLength={500}
                value={notes}
                onChangeText={setNotes}
                placeholder="Observações sobre a peça, garantia ou instrução do mecânico"
                placeholderTextColor={colors.textMuted}
              />
              {errors.notes && <Text style={styles.errorText}>{errors.notes}</Text>}
            </View>

            {/* Seção de Anexos / Notas Fiscais (US09.4) */}
            <View style={styles.attachmentSection}>
              <View style={styles.attachmentHeader}>
                <Text style={styles.fieldLabel}>NOTAS FISCAIS & COMPROVANTES (ATÉ 1 MB)</Text>
                <Text style={styles.attachmentCounter}>
                  {attachments.length} {attachments.length === 1 ? 'anexo' : 'anexos'}
                </Text>
              </View>

              <View style={styles.attachmentBtnRow}>
                <TouchableOpacity
                  style={styles.attachmentBtn}
                  onPress={() => handlePickAttachment('camera')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.attachmentBtnText}>📷 Tirar Foto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentBtn}
                  onPress={() => handlePickAttachment('gallery')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.attachmentBtnText}>🖼️ Galeria</Text>
                </TouchableOpacity>
              </View>

              {attachments.map(att => (
                <View key={att.id} style={styles.attachmentItem}>
                  <View style={styles.attachmentItemInfo}>
                    <Text style={styles.attachmentItemName} numberOfLines={1}>
                      📄 {att.localPath.split('/').pop() || 'comprovante.jpg'}
                    </Text>
                    <Text style={styles.attachmentItemMeta}>
                      {Math.round(att.fileSize / 1024)} KB • Status: {att.uploadStatus}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(att.id)}
                    style={styles.removeAttBtn}
                  >
                    <Text style={styles.removeAttText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isEditing ? 'Atualizar' : 'Salvar Manutenção'}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  formScroll: {
    padding: spacing.lg,
  },
  errorBanner: {
    backgroundColor: 'rgba(224, 90, 90, 0.15)',
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeOption: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeOptionSelected: {
    backgroundColor: colors.limeDim,
    borderColor: colors.lime,
  },
  typeText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeTextSelected: {
    color: colors.lime,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  chipSelected: {
    backgroundColor: colors.limeDim,
    borderColor: colors.lime,
  },
  chipIcon: {
    fontSize: 12,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.lime,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfCol: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 11,
    marginTop: 2,
  },
  attachmentSection: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attachmentCounter: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  attachmentBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  attachmentBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  attachmentBtnText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  attachmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  attachmentItemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  attachmentItemName: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  attachmentItemMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeAttBtn: {
    padding: 6,
  },
  removeAttText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: colors.lime,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 14,
  },
});
