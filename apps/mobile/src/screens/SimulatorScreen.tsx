import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {
  CustoViagemResult,
  EconomiaPotencialResult,
  EtanolGasolinaResult,
  SimulationRecord,
  SimulationType,
} from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import {
  compararEtanolGasolina,
  custoEconomiaPotencial,
  custoPrevistoViagem,
} from '../services/simulatorDomain';
import { SimulatorService } from '../services/simulatorService';
import { formatarDataColeta, formatarMoeda, formatDecimal } from '../utils/formatters';

interface SimulatorScreenProps {
  onClose: () => void;
}

const TABS: Array<{ key: SimulationType; label: string }> = [
  { key: 'etanol_gasolina', label: 'Etanol × Gasolina' },
  { key: 'economia_potencial', label: 'Economia' },
  { key: 'custo_viagem', label: 'Viagem' },
];

function parseDecimalInput(texto: string): number {
  const limpo = texto.replace(/[^\d.,]/g, '').replace(',', '.').trim();
  const num = Number(limpo);
  return Number.isFinite(num) ? num : 0;
}

function parseCentavosInput(texto: string): number {
  return Math.round(parseDecimalInput(texto) * 100);
}

function formatCentavosForInput(centavos: number | null): string {
  if (!centavos || centavos <= 0) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export const SimulatorScreen: React.FC<SimulatorScreenProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SimulationType>('etanol_gasolina');
  const [ultimas, setUltimas] = useState<SimulationRecord[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // Aba 1: Etanol × Gasolina
  const [precoEtanol, setPrecoEtanol] = useState<string>('');
  const [precoGasolina, setPrecoGasolina] = useState<string>('');
  const [resEtanol, setResEtanol] = useState<EtanolGasolinaResult | null>(null);

  // Aba 2: Economia potencial
  const [consumoAtual, setConsumoAtual] = useState<string>('10,0');
  const [consumoAlt, setConsumoAlt] = useState<string>('12,5');
  const [precoAtual, setPrecoAtual] = useState<string>('');
  const [precoAlt, setPrecoAlt] = useState<string>('');
  const [kmMes, setKmMes] = useState<string>('1000');
  const [resEconomia, setResEconomia] = useState<EconomiaPotencialResult | null>(null);

  // Aba 3: Custo de viagem
  const [distanciaKm, setDistanciaKm] = useState<string>('500');
  const [consumoViagem, setConsumoViagem] = useState<string>('12,5');
  const [precoViagem, setPrecoViagem] = useState<string>('');
  const [pedagios, setPedagios] = useState<string>('0');
  const [alimentacao, setAlimentacao] = useState<string>('0');
  const [resViagem, setResViagem] = useState<CustoViagemResult | null>(null);

  const carregarHistorico = useCallback(async () => {
    const lista = await SimulatorService.listarUltimas(10);
    setUltimas(lista);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const padroes = await SimulatorService.obterPrecosPadrao();
      if (!active) return;
      const gasStr = formatCentavosForInput(padroes.gasolinaCentavos);
      const etaStr = formatCentavosForInput(padroes.etanolCentavos);
      if (gasStr) {
        setPrecoGasolina(gasStr);
        setPrecoAtual(gasStr);
        setPrecoViagem(gasStr);
      }
      if (etaStr) {
        setPrecoEtanol(etaStr);
        setPrecoAlt(etaStr);
      }
      await carregarHistorico();
    })();
    return () => {
      active = false;
    };
  }, [carregarHistorico]);

  const handleSimular = async () => {
    setErro(null);
    try {
      if (activeTab === 'etanol_gasolina') {
        const etanolC = parseCentavosInput(precoEtanol);
        const gasC = parseCentavosInput(precoGasolina);
        const res = compararEtanolGasolina(etanolC, gasC);
        setResEtanol(res);
        await SimulatorService.salvarSimulacao(
          'etanol_gasolina',
          { precoEtanolCentavos: etanolC, precoGasolinaCentavos: gasC },
          res,
        );
      } else if (activeTab === 'economia_potencial') {
        const cAtual = parseDecimalInput(consumoAtual);
        const cAlt = parseDecimalInput(consumoAlt);
        const pAtual = parseCentavosInput(precoAtual);
        const pAlt = parseCentavosInput(precoAlt);
        const km = parseDecimalInput(kmMes);
        const res = custoEconomiaPotencial(cAtual, cAlt, pAtual, pAlt, km);
        setResEconomia(res);
        await SimulatorService.salvarSimulacao(
          'economia_potencial',
          {
            consumoAtualKml: cAtual,
            consumoAlternativoKml: cAlt,
            precoAtualCentavos: pAtual,
            precoAlternativoCentavos: pAlt,
            kmMes: km,
          },
          res,
        );
      } else {
        const dist = parseDecimalInput(distanciaKm);
        const cons = parseDecimalInput(consumoViagem);
        const preco = parseCentavosInput(precoViagem);
        const ped = parseCentavosInput(pedagios);
        const alim = parseCentavosInput(alimentacao);
        const res = custoPrevistoViagem(dist, cons, preco, ped, alim);
        setResViagem(res);
        await SimulatorService.salvarSimulacao(
          'custo_viagem',
          {
            distanciaKm: dist,
            consumoKml: cons,
            precoLitroCentavos: preco,
            pedagiosCentavos: ped,
            alimentacaoCentavos: alim,
          },
          res,
        );
      }
      await carregarHistorico();
    } catch (err: any) {
      setErro(err?.message || 'Verifique os valores informados para calcular.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Voltar">
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Simulador</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Abas */}
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const selected = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabBtn, selected && styles.tabBtnSelected]}
                onPress={() => {
                  setActiveTab(tab.key);
                  setErro(null);
                }}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Formulário da aba selecionada */}
        <View style={styles.card}>
          {activeTab === 'etanol_gasolina' ? (
            <>
              <Text style={styles.sectionLabel}>PREÇO DO ETANOL (R$/L)</Text>
              <TextInput
                style={styles.input}
                value={precoEtanol}
                onChangeText={setPrecoEtanol}
                keyboardType="decimal-pad"
                placeholder="4,08"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.sectionLabel}>PREÇO DA GASOLINA (R$/L)</Text>
              <TextInput
                style={styles.input}
                value={precoGasolina}
                onChangeText={setPrecoGasolina}
                keyboardType="decimal-pad"
                placeholder="6,00"
                placeholderTextColor={colors.textMuted}
              />
            </>
          ) : activeTab === 'economia_potencial' ? (
            <>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>CONSUMO ATUAL (KM/L)</Text>
                  <TextInput
                    style={styles.input}
                    value={consumoAtual}
                    onChangeText={setConsumoAtual}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>PREÇO ATUAL (R$/L)</Text>
                  <TextInput
                    style={styles.input}
                    value={precoAtual}
                    onChangeText={setPrecoAtual}
                    keyboardType="decimal-pad"
                    placeholder="6,00"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>CONSUMO ALT. (KM/L)</Text>
                  <TextInput
                    style={styles.input}
                    value={consumoAlt}
                    onChangeText={setConsumoAlt}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>PREÇO ALT. (R$/L)</Text>
                  <TextInput
                    style={styles.input}
                    value={precoAlt}
                    onChangeText={setPrecoAlt}
                    keyboardType="decimal-pad"
                    placeholder="4,08"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>QUILOMETRAGEM POR MÊS (KM)</Text>
              <TextInput
                style={styles.input}
                value={kmMes}
                onChangeText={setKmMes}
                keyboardType="decimal-pad"
              />
            </>
          ) : (
            <>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>DISTÂNCIA (KM)</Text>
                  <TextInput
                    style={styles.input}
                    value={distanciaKm}
                    onChangeText={setDistanciaKm}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>CONSUMO (KM/L)</Text>
                  <TextInput
                    style={styles.input}
                    value={consumoViagem}
                    onChangeText={setConsumoViagem}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>PREÇO DO LITRO (R$)</Text>
              <TextInput
                style={styles.input}
                value={precoViagem}
                onChangeText={setPrecoViagem}
                keyboardType="decimal-pad"
                placeholder="6,00"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>PEDÁGIOS (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={pedagios}
                    onChangeText={setPedagios}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>ALIMENTAÇÃO (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={alimentacao}
                    onChangeText={setAlimentacao}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </>
          )}

          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSimular} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Calcular e salvar</Text>
          </TouchableOpacity>
        </View>

        {/* Resultado da simulação */}
        {activeTab === 'etanol_gasolina' && resEtanol ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultHighlight}>{resEtanol.mensagem}</Text>
            <Text style={styles.mutedText}>
              Ponto de equilíbrio (70%): até {formatarMoeda(resEtanol.pontoEquilibrioCentavos / 100)}{' '}
              por litro de etanol.
            </Text>
          </View>
        ) : null}

        {activeTab === 'economia_potencial' && resEconomia ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultHighlight}>{resEconomia.mensagem}</Text>
            <Text style={styles.mutedText}>
              Atual: {formatarMoeda(resEconomia.custoMensalAtualCentavos / 100)}/mês · Alternativa:{' '}
              {formatarMoeda(resEconomia.custoMensalAlternativoCentavos / 100)}/mês
            </Text>
          </View>
        ) : null}

        {activeTab === 'custo_viagem' && resViagem ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultHighlight}>{resViagem.mensagem}</Text>
            <Text style={styles.mutedText}>
              {formatDecimal(resViagem.litrosEstimados, 1)} L · Combustível{' '}
              {formatarMoeda(resViagem.custoCombustivelCentavos / 100)} · Pedágios{' '}
              {formatarMoeda(resViagem.pedagiosCentavos / 100)} · Alimentação{' '}
              {formatarMoeda(resViagem.alimentacaoCentavos / 100)}
            </Text>
          </View>
        ) : null}

        {/* Últimas simulações salvas (US16.6) */}
        <Text style={styles.sectionLabel}>ÚLTIMAS SIMULAÇÕES</Text>
        <View style={styles.card}>
          {ultimas.length === 0 ? (
            <Text style={styles.mutedText}>Nenhuma simulação salva ainda.</Text>
          ) : (
            ultimas.map((sim, idx) => (
              <View
                key={sim.id}
                style={[styles.historyRow, idx === ultimas.length - 1 && styles.historyRowLast]}
              >
                <Text style={styles.bodyBoldText}>
                  {sim.resultado?.mensagem || 'Simulação registrada'}
                </Text>
                <Text style={styles.mutedText}>{formatarDataColeta(sim.criado_em)}</Text>
              </View>
            ))
          )}
        </View>
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
  tabRow: { flexDirection: 'row', gap: spacing.xs },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabBtnSelected: { backgroundColor: colors.limeDim, borderColor: colors.lime },
  tabText: { ...typography.caption, color: colors.textSecondary },
  tabTextSelected: { ...typography.captionBold, color: colors.lime },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1, gap: spacing.xs },
  sectionLabel: { ...typography.sectionLabel, color: colors.textMuted },
  input: {
    ...typography.body,
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
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnText: { ...typography.captionBold, color: colors.background },
  resultCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lime,
    padding: spacing.md,
    gap: spacing.xs,
  },
  resultHighlight: { ...typography.bodyBold, color: colors.lime },
  bodyBoldText: { ...typography.captionBold, color: colors.textPrimary },
  mutedText: { ...typography.caption, color: colors.textSecondary },
  errorText: { ...typography.caption, color: colors.error },
  historyRow: {
    gap: 4,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  historyRowLast: { borderBottomWidth: 0 },
});
