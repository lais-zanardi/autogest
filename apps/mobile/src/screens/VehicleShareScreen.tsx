import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import {
  PublicVehicleProfileResponse,
  VehicleShareCreatedResponse,
} from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { useAppStore } from '../store/useAppStore';
import {
  gerarMatrizQrVisual,
  VehicleShareService,
} from '../services/vehicleShareService';
import { CameraService } from '../services/cameraService';
import { formatarDataColeta, formatKm } from '../utils/formatters';

interface VehicleShareScreenProps {
  onClose: () => void;
}

export const VehicleShareScreen: React.FC<VehicleShareScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();
  const [activeShare, setActiveShare] = useState<VehicleShareCreatedResponse | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [revoking, setRevoking] = useState<boolean>(false);
  const [scanInput, setScanInput] = useState<string>('');
  const [loadingPublic, setLoadingPublic] = useState<boolean>(false);
  const [publicProfile, setPublicProfile] = useState<PublicVehicleProfileResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const qrMatrix = useMemo(
    () => (activeShare ? gerarMatrizQrVisual(activeShare.url_publica, 15) : []),
    [activeShare],
  );

  const handleGerarQr = async () => {
    if (!selectedVehicle?.id) {
      setErro('Selecione um veículo na Garagem antes de gerar o QR Code.');
      return;
    }
    setErro(null);
    setGenerating(true);
    try {
      const created = await VehicleShareService.gerarCompartilhamento(selectedVehicle.id);
      setActiveShare(created);
    } catch (err: any) {
      setErro(
        err?.response?.data?.error ||
          err?.message ||
          'Não foi possível gerar o link de compartilhamento.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCompartilharLink = async () => {
    if (!activeShare) return;
    await Share.share({
      message: `Confira o perfil público e histórico de manutenções do veículo: ${activeShare.url_publica}`,
      url: activeShare.url_publica,
    }).catch(() => {});
  };

  const handleRevogar = async () => {
    if (!selectedVehicle?.id || !activeShare) return;
    setRevoking(true);
    try {
      await VehicleShareService.revogarCompartilhamento(selectedVehicle.id, activeShare.id);
      setActiveShare(null);
      Alert.alert('Link revogado', 'Este QR Code não dá mais acesso ao perfil do veículo.');
    } catch (err: any) {
      setErro(err?.response?.data?.error || err?.message || 'Não foi possível revogar o link.');
    } finally {
      setRevoking(false);
    }
  };

  const handleAbrirCameraLeitura = async () => {
    const granted = await CameraService.requestCameraPermission();
    if (!granted) {
      Alert.alert(
        'Permissão necessária',
        'Conceda acesso à câmera para ler QR Codes ou cole o link do perfil abaixo.',
      );
      return;
    }
    Alert.alert(
      'Leitura de QR Code',
      'Aponte para o QR Code ou cole o link do perfil no campo abaixo para abrir o histórico.',
    );
  };

  const handleConsultarPerfil = async () => {
    setErro(null);
    setLoadingPublic(true);
    try {
      const profile = await VehicleShareService.consultarPerfilPublico(scanInput);
      setPublicProfile(profile);
    } catch (err: any) {
      setPublicProfile(null);
      setErro(err?.response?.data?.error || err?.message || 'Perfil indisponível ou link expirado.');
    } finally {
      setLoadingPublic(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Voltar">
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compartilhar perfil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Seção 1: Gerar e revogar QR Code do veículo ativo */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>PERFIL PÚBLICO DO SEU VEÍCULO</Text>
          <Text style={styles.mutedText}>
            Compartilhe modelo, ano, placa e histórico de manutenções (sem dados pessoais, notas ou
            localização). Validade padrão de 30 dias, revogável a qualquer momento.
          </Text>

          {activeShare ? (
            <View style={styles.qrSection}>
              <View style={styles.qrBox}>
                <Svg width={150} height={150} viewBox="0 0 15 15">
                  {qrMatrix.map((row, rIdx) =>
                    row.map((filled, cIdx) =>
                      filled ? (
                        <Rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx}
                          y={rIdx}
                          width={1}
                          height={1}
                          fill={colors.background}
                        />
                      ) : null,
                    ),
                  )}
                </Svg>
              </View>

              <Text style={styles.mutedText}>
                Expira em {formatarDataColeta(activeShare.expira_em)}
              </Text>
              <Text style={styles.urlText} selectable>
                {activeShare.url_publica}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleCompartilharLink}>
                  <Icon name="Share2" size={15} color={colors.background} />
                  <Text style={styles.primaryBtnText}>Compartilhar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={handleRevogar}
                  disabled={revoking}
                >
                  <Text style={styles.dangerBtnText}>
                    {revoking ? 'Revogando...' : 'Revogar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleGerarQr}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Icon name="QrCode" size={16} color={colors.background} />
                  <Text style={styles.primaryBtnText}>Gerar QR Code</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Seção 2: Ler QR Code de outro veículo */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ABRIR PERFIL DE OUTRO VEÍCULO</Text>
          <View style={styles.actionRow}>
            <TextInput
              style={styles.input}
              value={scanInput}
              onChangeText={setScanInput}
              placeholder="Cole o link ou código do QR"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.iconActionBtn} onPress={handleAbrirCameraLeitura}>
              <Icon name="Camera" size={18} color={colors.lime} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleConsultarPerfil}
            disabled={loadingPublic}
          >
            <Text style={styles.secondaryBtnText}>
              {loadingPublic ? 'Consultando...' : 'Abrir perfil público'}
            </Text>
          </TouchableOpacity>

          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}
        </View>

        {/* Resultado do perfil público consultado */}
        {publicProfile ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PRONTUÁRIO PÚBLICO</Text>
            <Text style={styles.vehicleTitle}>
              {publicProfile.veiculo.marca ? `${publicProfile.veiculo.marca} ` : ''}
              {publicProfile.veiculo.modelo} ({publicProfile.veiculo.ano})
            </Text>
            <Text style={styles.mutedText}>
              Placa {publicProfile.veiculo.placa} · {publicProfile.veiculo.combustivel_preferencial}{' '}
              · {formatKm(publicProfile.veiculo.odometro_atual)}
            </Text>

            <Text style={styles.sectionLabel}>MANUTENÇÕES ({publicProfile.manutencoes.length})</Text>
            {publicProfile.manutencoes.length === 0 ? (
              <Text style={styles.mutedText}>Nenhuma manutenção registrada.</Text>
            ) : (
              publicProfile.manutencoes.map((m, idx) => (
                <View key={`${m.data}-${idx}`} style={styles.maintRow}>
                  <Text style={styles.maintTitle}>{m.descricao}</Text>
                  <Text style={styles.mutedText}>
                    {formatarDataColeta(m.data)} · {m.tipo} · {formatKm(m.km)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
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
  mutedText: { ...typography.caption, color: colors.textSecondary },
  errorText: { ...typography.caption, color: colors.error },
  qrSection: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  qrBox: {
    backgroundColor: colors.textPrimary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  urlText: { ...typography.caption, color: colors.lime, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.xs, width: '100%' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    height: 44,
  },
  primaryBtnText: { ...typography.captionBold, color: colors.background },
  secondaryBtn: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { ...typography.captionBold, color: colors.textPrimary },
  dangerBtn: {
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { ...typography.captionBold, color: colors.error },
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
  iconActionBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTitle: { ...typography.h3, color: colors.textPrimary },
  maintRow: {
    gap: 2,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  maintTitle: { ...typography.bodyBold, color: colors.textPrimary },
});
