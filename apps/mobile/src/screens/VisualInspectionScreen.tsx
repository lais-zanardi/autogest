import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { InspectionReminderRecord } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { useAppStore } from '../store/useAppStore';
import {
  ITENS_INSPECAO_PREDEFINIDOS,
  proximoCicloInspecao,
} from '../services/visualInspectionDomain';
import { VisualInspectionService } from '../services/visualInspectionService';
import { formatarDataColeta } from '../utils/formatters';

interface VisualInspectionScreenProps {
  onClose: () => void;
}

export const VisualInspectionScreen: React.FC<VisualInspectionScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();
  const [lembretes, setLembretes] = useState<InspectionReminderRecord[]>([]);
  const [itemSelecionado, setItemSelecionado] = useState<string>(ITENS_INSPECAO_PREDEFINIDOS[0]);
  const [periodicidadeInput, setPeriodicidadeInput] = useState<string>('30');
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const vehicleId = selectedVehicle?.id || 'default_vehicle';
    const lista = await VisualInspectionService.listarLembretes(vehicleId);
    setLembretes(lista);
  }, [selectedVehicle?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleCriar = async () => {
    setErro(null);
    const dias = Number(periodicidadeInput.replace(/\D/g, ''));
    if (!Number.isFinite(dias) || dias <= 0) {
      setErro('Informe uma periodicidade em dias maior que zero.');
      return;
    }

    try {
      const vehicleId = selectedVehicle?.id || 'default_vehicle';
      await VisualInspectionService.criarLembrete({
        veiculoId: vehicleId,
        item: itemSelecionado,
        periodicidadeDias: dias,
        ativo: true,
      });
      await carregar();
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível criar o lembrete.');
    }
  };

  const handleMarcarFeita = async (lembrete: InspectionReminderRecord) => {
    await VisualInspectionService.marcarInspecaoFeita(lembrete.id);
    await carregar();
  };

  const handleToggleAtivo = async (lembrete: InspectionReminderRecord, ativo: boolean) => {
    await VisualInspectionService.alternarAtivo(lembrete.id, ativo);
    await carregar();
  };

  const handleExcluir = (lembrete: InspectionReminderRecord) => {
    Alert.alert('Remover lembrete', `Deseja remover o lembrete de "${lembrete.item}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await VisualInspectionService.excluirLembrete(lembrete.id);
          await carregar();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Voltar">
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspeção visual</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>NOVO LEMBRETE PERIÓDICO</Text>
          <View style={styles.chipRow}>
            {ITENS_INSPECAO_PREDEFINIDOS.map(item => {
              const selected = item === itemSelecionado;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setItemSelecionado(item)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>PERIODICIDADE (DIAS)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={periodicidadeInput}
              onChangeText={setPeriodicidadeInput}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCriar} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>LEMBRETES CONFIGURADOS</Text>
        {lembretes.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>
              Nenhum lembrete de inspeção visual cadastrado para este veículo.
            </Text>
          </View>
        ) : (
          lembretes.map(lembrete => {
            const prox = proximoCicloInspecao(lembrete);
            return (
              <View key={lembrete.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.infoCol}>
                    <Text style={styles.itemTitle}>{lembrete.item}</Text>
                    <Text style={styles.mutedText}>
                      A cada {lembrete.periodicidade_dias} dias · Próxima em{' '}
                      {formatarDataColeta(prox.proximaDataIso)}
                    </Text>
                  </View>
                  <Switch
                    value={lembrete.ativo}
                    onValueChange={val => handleToggleAtivo(lembrete, val)}
                    trackColor={{ false: colors.surfaceRaised, true: colors.limeDim }}
                    thumbColor={lembrete.ativo ? colors.lime : colors.textMuted}
                  />
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => handleMarcarFeita(lembrete)}
                    activeOpacity={0.8}
                  >
                    <Icon name="Check" size={14} color={colors.background} />
                    <Text style={styles.doneBtnText}>Inspeção feita</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleExcluir(lembrete)}
                  >
                    <Text style={styles.deleteBtnText}>Remover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: { ...typography.sectionLabel, color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.limeDim, borderColor: colors.lime },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { ...typography.captionBold, color: colors.lime },
  inputRow: { flexDirection: 'row', gap: spacing.xs },
  input: {
    ...typography.body,
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
    color: colors.textPrimary,
  },
  primaryBtn: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...typography.captionBold, color: colors.background },
  errorText: { ...typography.caption, color: colors.error },
  mutedText: { ...typography.caption, color: colors.textSecondary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  infoCol: { flex: 1, gap: 2 },
  itemTitle: { ...typography.bodyBold, color: colors.textPrimary },
  actionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  doneBtnText: { ...typography.captionBold, color: colors.background },
  deleteBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  deleteBtnText: { ...typography.caption, color: colors.textSecondary },
});
