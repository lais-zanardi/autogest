import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Refuel } from '@autogest/shared-types';
import { useTheme, typography } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { ConsumptionChartCard } from '../components/charts/ConsumptionChartCard';
import { formatarConsumo } from '../services/preferencesService';
import { VehicleHeaderSelector } from '../components/VehicleHeaderSelector';
import { consumoPorTipoPercurso } from '../services/routeContextService';
import { Icon } from '../components/Icon';

interface ConsumptionScreenProps {
  onClose?: () => void;
}

export const ConsumptionScreen: React.FC<ConsumptionScreenProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const selectedVehicle = useAppStore(state => state.selectedVehicle);

  const [refuels, setRefuels] = useState<Refuel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAbastecimentos();
  }, [selectedVehicle?.id]);

  const carregarAbastecimentos = async () => {
    if (!selectedVehicle?.id) {
      setRefuels([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await RefuelRepository.listByVehicle(selectedVehicle.id);
      setRefuels(list);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o histórico de abastecimentos do veículo.');
    } finally {
      setLoading(false);
    }
  };

  // Métricas agregadas do veículo selecionado
  const { mediaGeralKml, melhorConsumoKml, totalAbastecimentosValidos } = useMemo(() => {
    const consumos = refuels
      .map(r => r.calculatedKml)
      .filter((k): k is number => k !== null && k !== undefined && k > 0);

    if (consumos.length === 0) {
      return {
        mediaGeralKml: null,
        melhorConsumoKml: null,
        totalAbastecimentosValidos: 0,
      };
    }

    const soma = consumos.reduce((a, b) => a + b, 0);
    const media = soma / consumos.length;
    const melhor = Math.max(...consumos);

    return {
      mediaGeralKml: Number(media.toFixed(2)),
      melhorConsumoKml: melhor,
      totalAbastecimentosValidos: consumos.length,
    };
  }, [refuels]);

  // US27.6: Consumo por Tipo de Percurso
  const consumoPorTipo = useMemo(() => {
    return consumoPorTipoPercurso(refuels);
  }, [refuels]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Superior */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleCol}>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>Consumo & Média Móvel</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Análise e tendência de rendimento energético
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.surface }]}
            accessibilityLabel="Fechar tela de consumo"
          >
            <Icon name="X" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Seletor de Veículo Ativo */}
        {selectedVehicle && <VehicleHeaderSelector />}

        {/* Resumo de Indicadores Principais de Consumo */}
        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[typography.caption, { color: colors.textSecondary }]}>MÉDIA GERAL</Text>
            <Text style={[typography.h3, { color: colors.lime, marginTop: 4 }]}>
              {mediaGeralKml ? formatarConsumo(mediaGeralKml) : '--'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {totalAbastecimentosValidos} abastecimentos
            </Text>
          </View>

          <View
            style={[
              styles.metricCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[typography.caption, { color: colors.textSecondary }]}>MELHOR MARCA</Text>
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 4 }]}>
              {melhorConsumoKml ? formatarConsumo(melhorConsumoKml) : '--'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Rendimento pico
            </Text>
          </View>
        </View>

        {/* Gráfico Interativo com Média Móvel e Granularidade (US25.2, US25.3 & US25.4) */}
        <ConsumptionChartCard refuels={refuels} isLoading={loading} />

        {/* US27.6: Cartão de Consumo Médio por Tipo de Percurso */}
        <View
          style={[
            styles.routeTypeCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8 }]}>
            CONSUMO POR TIPO DE PERCURSO
          </Text>
          <View style={styles.routeTypeGrid}>
            <View
              style={[
                styles.routeTypeItem,
                { borderRightColor: colors.border, borderRightWidth: 1 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="Building" size={12} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>Urbano</Text>
              </View>
              <Text style={[typography.bodyBold, { color: colors.lime, marginTop: 2 }]}>
                {consumoPorTipo.urbano.mediaKml > 0
                  ? formatarConsumo(consumoPorTipo.urbano.mediaKml)
                  : '--'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                {consumoPorTipo.urbano.totalRegistros} reg.
              </Text>
            </View>

            <View
              style={[
                styles.routeTypeItem,
                { borderRightColor: colors.border, borderRightWidth: 1 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="Navigation" size={12} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>Rodoviário</Text>
              </View>
              <Text style={[typography.bodyBold, { color: colors.lime, marginTop: 2 }]}>
                {consumoPorTipo.rodoviario.mediaKml > 0
                  ? formatarConsumo(consumoPorTipo.rodoviario.mediaKml)
                  : '--'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                {consumoPorTipo.rodoviario.totalRegistros} reg.
              </Text>
            </View>

            <View
              style={[
                styles.routeTypeItem,
                { borderRightColor: colors.border, borderRightWidth: 1 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="Shuffle" size={12} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>Misto</Text>
              </View>
              <Text style={[typography.bodyBold, { color: colors.lime, marginTop: 2 }]}>
                {consumoPorTipo.misto.mediaKml > 0
                  ? formatarConsumo(consumoPorTipo.misto.mediaKml)
                  : '--'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                {consumoPorTipo.misto.totalRegistros} reg.
              </Text>
            </View>

            <View style={styles.routeTypeItem}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Não inform.</Text>
              <Text style={[typography.bodyBold, { color: colors.textSecondary, marginTop: 2 }]}>
                {consumoPorTipo.naoInformado.mediaKml > 0
                  ? formatarConsumo(consumoPorTipo.naoInformado.mediaKml)
                  : '--'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                {consumoPorTipo.naoInformado.totalRegistros} reg.
              </Text>
            </View>
          </View>
        </View>

        {/* Informações Técnicas e Explicativas sobre a Média Móvel */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="Lightbulb" size={16} color={colors.lime} />
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              Sobre a Média Móvel de 5 períodos
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
            A média móvel suaviza oscilações temporárias causadas por trânsito pesado, uso intenso
            de ar-condicionado ou percursos acidentados, revelando a verdadeira tendência mecânica
            de eficiência do seu veículo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleCol: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  routeTypeCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  routeTypeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeTypeItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});
