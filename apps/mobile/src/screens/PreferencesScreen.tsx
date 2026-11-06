import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../theme';
import { ConsumptionUnit } from '@autogest/shared-types';
import {
  PreferencesService,
  formatarConsumo,
  formatarFaixaPausaNotificacoes,
} from '../services/preferencesService';
import { NotificacaoService } from '../services/notificationService';

interface PreferencesScreenProps {
  onClose: () => void;
}

export const PreferencesScreen: React.FC<PreferencesScreenProps> = ({ onClose }) => {
  const { colors, typography, spacing } = useTheme();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [unidade, setUnidade] = useState<ConsumptionUnit>('km/l');
  const [pausadasAte, setPausadasAte] = useState<string | null>(null);

  // Estados do formulário de pausa
  const [modoPausa, setModoPausa] = useState<'dias' | 'data'>('dias');
  const [diasPausa, setDiasPausa] = useState('7');
  const [dataPausaTexto, setDataPausaTexto] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    carregarPreferencias();
  }, []);

  const carregarPreferencias = async () => {
    try {
      setLoading(true);
      const prefs = await PreferencesService.obterPreferencias();
      setUnidade(prefs.unidade_consumo_principal || 'km/l');
      setPausadasAte(prefs.notificacoes_pausadas_ate);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar as preferências.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrocarUnidade = async (novaUnidade: ConsumptionUnit) => {
    try {
      setSalvando(true);
      await PreferencesService.definirUnidadeConsumoPrincipal(novaUnidade);
      setUnidade(novaUnidade);
      setMensagemSucesso(`Unidade principal alterada para ${novaUnidade}.`);
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar preferência de unidade.');
    } finally {
      setSalvando(false);
    }
  };

  const handlePausar = async () => {
    try {
      setSalvando(true);
      if (modoPausa === 'dias') {
        const diasNum = parseInt(diasPausa, 10);
        if (Number.isNaN(diasNum) || diasNum <= 0) {
          Alert.alert('Atenção', 'Informe um número de dias válido e maior que zero.');
          return;
        }
        const novaDataAte = await NotificacaoService.pausarAte({ duracaoDias: diasNum });
        setPausadasAte(novaDataAte);
        setMensagemSucesso(`Notificações pausadas por ${diasNum} dias.`);
      } else {
        if (!dataPausaTexto.trim()) {
          Alert.alert('Atenção', 'Informe a data final obrigatória para a pausa (dd/mm/aaaa).');
          return;
        }
        const novaDataAte = await NotificacaoService.pausarAte({
          dataFinal: dataPausaTexto.trim(),
        });
        setPausadasAte(novaDataAte);
        setMensagemSucesso('Notificações pausadas com sucesso.');
      }
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (err: any) {
      Alert.alert('Erro na Pausa', err.message || 'Falha ao pausar notificações.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRetomar = async () => {
    try {
      setSalvando(true);
      const res = await NotificacaoService.retomarAgora();
      setPausadasAte(null);
      let msg = 'Notificações retomadas com sucesso!';
      if (res.alertasVencidos.length > 0) {
        msg += ` ${res.alertasVencidos.length} alerta(s) vencido(s) verificado(s).`;
      }
      setMensagemSucesso(msg);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao retomar notificações.');
    } finally {
      setSalvando(false);
    }
  };

  const faixaPausa = useMemo(() => {
    return formatarFaixaPausaNotificacoes(pausadasAte);
  }, [pausadasAte]);

  const exemploConsumo = useMemo(() => {
    return formatarConsumo(12.5, unidade);
  }, [unidade]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>Preferências</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Configurações › Unidade e Notificações
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.closeButton, { backgroundColor: colors.surface }]}
          accessibilityLabel="Fechar tela de preferências"
        >
          <Text style={[styles.closeText, { color: colors.textPrimary }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.lime} />
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
            Carregando preferências locais...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}>
          {/* Mensagem de Feedback de Sucesso */}
          {mensagemSucesso && (
            <View
              style={[
                styles.feedbackBanner,
                { backgroundColor: colors.surface, borderColor: colors.lime },
              ]}
            >
              <Text style={[typography.body, { color: colors.lime, fontWeight: '600' }]}>
                ✓ {mensagemSucesso}
              </Text>
            </View>
          )}

          {/* Faixa Notificações Pausadas (US39.5) */}
          {faixaPausa && (
            <View
              style={[
                styles.pauseBanner,
                { backgroundColor: '#3A2E00', borderColor: colors.amber },
              ]}
            >
              <View style={styles.pauseBannerTextContainer}>
                <Text style={[typography.body, { color: colors.amber, fontWeight: '700' }]}>
                  ⏸ {faixaPausa}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Lembretes preventivos estão silenciados.
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleRetomar}
                disabled={salvando}
                style={[styles.resumeButton, { backgroundColor: colors.amber }]}
                accessibilityLabel="Retomar notificações agora"
              >
                <Text style={[styles.resumeButtonText, { color: '#000' }]}>Retomar agora</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Seção 1: Unidade de Consumo Principal (US39.2 & US39.3) */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Unidade de Consumo Principal
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: spacing.md },
              ]}
            >
              Escolha a unidade exibida em destaque nas telas de dashboard, históricos e
              indicadores. A unidade secundária continuará visível entre parênteses.
            </Text>

            <View style={styles.unitSelectorContainer}>
              <TouchableOpacity
                style={[
                  styles.unitOption,
                  unidade === 'km/l'
                    ? { backgroundColor: colors.lime, borderColor: colors.lime }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => handleTrocarUnidade('km/l')}
                disabled={salvando}
                activeOpacity={0.8}
                accessibilityLabel="Selecionar unidade principal km/l"
              >
                <Text
                  style={[
                    styles.unitOptionTitle,
                    { color: unidade === 'km/l' ? '#000' : colors.textPrimary },
                  ]}
                >
                  km/l
                </Text>
                <Text
                  style={[
                    styles.unitOptionDesc,
                    { color: unidade === 'km/l' ? '#222' : colors.textSecondary },
                  ]}
                >
                  Quilômetros por litro (Brasil)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.unitOption,
                  unidade === 'L/100 km'
                    ? { backgroundColor: colors.lime, borderColor: colors.lime }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => handleTrocarUnidade('L/100 km')}
                disabled={salvando}
                activeOpacity={0.8}
                accessibilityLabel="Selecionar unidade principal L/100 km"
              >
                <Text
                  style={[
                    styles.unitOptionTitle,
                    { color: unidade === 'L/100 km' ? '#000' : colors.textPrimary },
                  ]}
                >
                  L/100 km
                </Text>
                <Text
                  style={[
                    styles.unitOptionDesc,
                    { color: unidade === 'L/100 km' ? '#222' : colors.textSecondary },
                  ]}
                >
                  Litros por 100 km (Padrão europeu)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Demonstração em Tempo Real da Formatação */}
            <View
              style={[
                styles.previewBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Exemplo de exibição no app:
              </Text>
              <Text style={[typography.h3, { color: colors.lime, marginTop: 2 }]}>
                {exemploConsumo}
              </Text>
            </View>
          </View>

          {/* Seção 2: Pausa Global de Notificações (US39.5) */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Pausa de Notificações
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: spacing.md },
              ]}
            >
              Silencie alertas e lembretes preventivos temporariamente (ex.: durante viagens ou
              férias). Os alertas vencidos no período voltarão a ser exibidos após o término.
            </Text>

            {/* Alternância de Modo: Duração (dias) vs Data Final */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleTab,
                  modoPausa === 'dias'
                    ? { backgroundColor: colors.surface, borderColor: colors.lime }
                    : { borderColor: colors.border },
                ]}
                onPress={() => setModoPausa('dias')}
              >
                <Text
                  style={[
                    typography.body,
                    {
                      color: modoPausa === 'dias' ? colors.lime : colors.textSecondary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  Por duração (dias)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleTab,
                  modoPausa === 'data'
                    ? { backgroundColor: colors.surface, borderColor: colors.lime }
                    : { borderColor: colors.border },
                ]}
                onPress={() => setModoPausa('data')}
              >
                <Text
                  style={[
                    typography.body,
                    {
                      color: modoPausa === 'data' ? colors.lime : colors.textSecondary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  Por data final
                </Text>
              </TouchableOpacity>
            </View>

            {modoPausa === 'dias' ? (
              <View style={styles.inputGroup}>
                <Text
                  style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}
                >
                  Duração da pausa (dias):
                </Text>
                <View style={styles.quickDaysRow}>
                  {['3', '7', '15', '30'].map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.quickDayButton,
                        diasPausa === d
                          ? { backgroundColor: colors.lime, borderColor: colors.lime }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() => setDiasPausa(d)}
                    >
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: diasPausa === d ? '#000' : colors.textPrimary,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {d} dias
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={diasPausa}
                  onChangeText={setDiasPausa}
                  placeholder="Ou digite a quantidade de dias..."
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text
                  style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}
                >
                  Data final obrigatória (DD/MM/AAAA):
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={dataPausaTexto}
                  onChangeText={setDataPausaTexto}
                  placeholder="Ex.: 25/12/2026"
                  placeholderTextColor={colors.textMuted}
                  maxLength={10}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.pauseActionButton, { backgroundColor: colors.lime }]}
              onPress={handlePausar}
              disabled={salvando}
              activeOpacity={0.8}
              accessibilityLabel="Confirmar pausa de notificações"
            >
              {salvando ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.pauseActionText}>⏸ Confirmar Pausa de Notificações</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
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
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 16,
  },
  feedbackBanner: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  pauseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  pauseBannerTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  resumeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  resumeButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  unitSelectorContainer: {
    gap: 10,
    marginBottom: 14,
  },
  unitOption: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  unitOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  unitOptionDesc: {
    fontSize: 12,
  },
  previewBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  inputGroup: {
    marginBottom: 14,
  },
  quickDaysRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  quickDayButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  pauseActionButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  pauseActionText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
