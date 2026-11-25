import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { useAppStore } from '../store/useAppStore';
import { MonthlySummaryPreferencesService } from '../services/monthlySummaryPreferencesService';

interface MonthlySummaryEmailScreenProps {
  onClose: () => void;
}

export const MonthlySummaryEmailScreen: React.FC<MonthlySummaryEmailScreenProps> = ({
  onClose,
}) => {
  const { user } = useAppStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [receberResumo, setReceberResumo] = useState<boolean>(false);
  const [emailDestino, setEmailDestino] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const pref = await MonthlySummaryPreferencesService.obterPreferencia();
        if (!mounted) {
          return;
        }
        setReceberResumo(pref.receber_resumo);
        setEmailDestino(pref.email_destino || user?.email || '');
      } catch {
        if (mounted) {
          setErro('Não foi possível carregar sua preferência de resumo mensal.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.email]);

  const handleSalvar = async () => {
    setErro(null);
    setSucesso(null);
    setSaving(true);
    try {
      const saved = await MonthlySummaryPreferencesService.salvarPreferencia({
        receberResumo,
        emailDestino,
      });
      setReceberResumo(saved.receber_resumo);
      setEmailDestino(saved.email_destino);
      setSucesso(
        saved.receber_resumo
          ? `Resumo mensal ativado para ${saved.email_destino}.`
          : 'Envio de resumo mensal por e-mail desativado.',
      );
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível salvar a preferência.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityLabel="Fechar resumo mensal por e-mail"
        >
          <Icon name="X" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resumo mensal por e-mail</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.lime} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle}>Receber resumo mensal por e-mail</Text>
                <Text style={styles.toggleSubtitle}>
                  Desativado por padrão. Você pode ativar ou desativar a qualquer momento.
                </Text>
              </View>
              <Switch
                value={receberResumo}
                onValueChange={(value) => {
                  setReceberResumo(value);
                  setErro(null);
                  setSucesso(null);
                }}
                trackColor={{ false: colors.border, true: colors.lime }}
                thumbColor={receberResumo ? colors.background : colors.textSecondary}
                accessibilityLabel="Receber resumo mensal por e-mail"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>E-MAIL DE DESTINO</Text>
            <TextInput
              style={styles.input}
              value={emailDestino}
              onChangeText={(text) => {
                setEmailDestino(text);
                setErro(null);
                setSucesso(null);
              }}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="E-mail de destino do resumo mensal"
            />
            <Text style={styles.helperText}>
              O resumo será enviado apenas para o endereço informado acima no fechamento de cada mês.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoHeader}>
              <Icon name="Shield" size={18} color={colors.lime} />
              <Text style={styles.infoTitle}>O que será enviado no e-mail</Text>
            </View>
            <Text style={styles.infoItem}>• Gastos totais consolidados no mês (R$)</Text>
            <Text style={styles.infoItem}>• Consumo médio registrado (km/L)</Text>
            <Text style={styles.infoItem}>• Quilometragem percorrida no período (km)</Text>
            <Text style={styles.infoFootnote}>
              Nenhum dado sensível, placa, localização ou comprovante é incluído. Cada mensagem traz
              um link de cancelamento imediato.
            </Text>
          </View>

          {erro ? (
            <View style={styles.feedbackError}>
              <Icon name="AlertCircle" size={18} color={colors.error} />
              <Text style={styles.feedbackErrorText}>{erro}</Text>
            </View>
          ) : null}

          {sucesso ? (
            <View style={styles.feedbackSuccess}>
              <Icon name="CheckCircle" size={18} color={colors.lime} />
              <Text style={styles.feedbackSuccessText}>{sucesso}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSalvar}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Salvar preferência de resumo mensal"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>Salvar preferência</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 36,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  toggleSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  infoTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  infoItem: {
    ...typography.body,
    color: colors.textSecondary,
  },
  infoFootnote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  feedbackError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  feedbackErrorText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
  feedbackSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  feedbackSuccessText: {
    ...typography.caption,
    color: colors.lime,
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.bodyBold,
    color: colors.background,
  },
});
