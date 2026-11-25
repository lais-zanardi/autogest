import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { DrivingProfileCorrelationResult, DrivingProfileType } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { InteractiveBarChart, BarChartItem } from '../components/charts/InteractiveCharts';
import { useAppStore } from '../store/useAppStore';
import { PERFIS_CONDUCAO_OPCOES } from '../services/drivingProfileDomain';
import { DrivingProfileService } from '../services/drivingProfileService';
import { formatarConsumo } from '../utils/formatters';

interface DrivingProfileScreenProps {
  onClose: () => void;
}

const PROFILE_COLORS: Record<DrivingProfileType, string> = {
  economico: colors.lime,
  normal: '#56B4E9',
  agressivo: colors.amber,
};

export const DrivingProfileScreen: React.FC<DrivingProfileScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();
  const [perfilAtual, setPerfilAtual] = useState<DrivingProfileType>('normal');
  const [correlacao, setCorrelacao] = useState<DrivingProfileCorrelationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const carregar = useCallback(async () => {
    if (!selectedVehicle?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [atual, corr] = await Promise.all([
        DrivingProfileService.obterPerfilAtual(selectedVehicle.id),
        DrivingProfileService.obterCorrelacaoDoVeiculo(selectedVehicle.id),
      ]);
      setPerfilAtual(atual);
      setCorrelacao(corr);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleSelectProfile = async (perfil: DrivingProfileType) => {
    if (!selectedVehicle?.id) return;
    setSaving(true);
    try {
      await DrivingProfileService.definirPerfil(selectedVehicle.id, perfil);
      setPerfilAtual(perfil);
    } finally {
      setSaving(false);
    }
  };

  const barData: BarChartItem[] = useMemo(() => {
    if (!correlacao) return [];
    return correlacao.itens
      .filter(i => i.mediaKml !== null && i.totalAbastecimentos > 0)
      .map(item => ({
        id: item.perfil,
        label: `${item.rotulo} (${item.totalAbastecimentos})`,
        value: item.mediaKml || 0,
        formattedValue: formatarConsumo(item.mediaKml) || '--',
        color: PROFILE_COLORS[item.perfil],
      }));
  }, [correlacao]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Voltar">
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil de condução</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>COMO VOCÊ COSTUMA DIRIGIR</Text>
        <Text style={styles.mutedText}>
          Você pode mudar esta autoavaliação a qualquer momento. Os abastecimentos anteriores
          mantêm o perfil que estava ativo na data do registro.
        </Text>

        {PERFIS_CONDUCAO_OPCOES.map(opcao => {
          const selected = opcao.valor === perfilAtual;
          return (
            <TouchableOpacity
              key={opcao.valor}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => handleSelectProfile(opcao.valor)}
              disabled={saving}
              activeOpacity={0.85}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                  {opcao.rotulo}
                </Text>
                {selected ? <Icon name="CheckCircle" size={18} color={colors.lime} /> : null}
              </View>
              <Text style={styles.mutedText}>{opcao.descricao}</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.sectionLabel}>CONSUMO MÉDIO POR PERFIL</Text>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.lime} />
          </View>
        ) : !correlacao || !correlacao.dadosSuficientes ? (
          <View style={styles.card}>
            <Icon name="BarChart2" size={24} color={colors.textSecondary} />
            <Text style={styles.optionTitle}>Ainda há poucos dados</Text>
            <Text style={styles.mutedText}>
              Registre pelo menos 3 abastecimentos com tanque cheio para visualizar o gráfico
              comparativo de consumo por perfil de condução.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <InteractiveBarChart data={barData} />
            <View style={styles.summaryList}>
              {correlacao.itens.map(item => (
                <View key={item.perfil} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {item.rotulo} ({item.totalAbastecimentos}{' '}
                    {item.totalAbastecimentos === 1 ? 'abastecimento' : 'abastecimentos'})
                  </Text>
                  <Text style={styles.summaryValue}>
                    {item.mediaKml ? formatarConsumo(item.mediaKml) : '--'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
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
  sectionLabel: { ...typography.sectionLabel, color: colors.textMuted },
  mutedText: { ...typography.caption, color: colors.textSecondary },
  optionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  optionCardSelected: {
    backgroundColor: colors.limeDim,
    borderColor: colors.lime,
  },
  optionTitle: { ...typography.bodyBold, color: colors.textPrimary },
  optionTitleSelected: { color: colors.lime },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  summaryList: { gap: spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  summaryLabel: { ...typography.caption, color: colors.textSecondary },
  summaryValue: { ...typography.captionBold, color: colors.textPrimary },
});
