import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { VehiclePhotoRecord } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { useAppStore } from '../store/useAppStore';
import { CameraService } from '../services/cameraService';
import { VehiclePhotoService } from '../services/vehiclePhotoService';
import { formatarDataColeta } from '../utils/formatters';

interface VehiclePhotosScreenProps {
  onClose: () => void;
}

export const VehiclePhotosScreen: React.FC<VehiclePhotosScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();
  const [fotos, setFotos] = useState<VehiclePhotoRecord[]>([]);
  const [legenda, setLegenda] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  const capaId = selectedVehicle?.foto_capa_id || selectedVehicle?.coverPhotoId || null;

  const carregar = useCallback(async () => {
    if (!selectedVehicle?.id) {
      setFotos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lista = await VehiclePhotoService.listarGaleriaCronologica(selectedVehicle.id);
      setFotos(lista);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleCapturar = async (source: 'camera' | 'gallery') => {
    if (!selectedVehicle?.id) {
      setErro('Selecione um veículo na Garagem antes de adicionar fotos.');
      return;
    }
    setErro(null);
    setCapturing(true);
    try {
      const picked = await CameraService.pickMaintenanceImage(source);
      if (!picked) return;

      const nova = await VehiclePhotoService.adicionarFoto({
        veiculoId: selectedVehicle.id,
        data: new Date().toISOString().slice(0, 10),
        legenda: legenda.trim() || null,
        localPath: picked.uri,
        fileSize: picked.fileSize,
        mimeType: picked.mimeType,
      });

      setLegenda('');
      await carregar();
      // Envio em background usando o mesmo fluxo de URL assinada da US09
      VehiclePhotoService.enviarFotoParaNuvem(nova.id).then(() => carregar()).catch(() => {});
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível adicionar a foto.');
    } finally {
      setCapturing(false);
    }
  };

  const handleDefinirCapa = async (fotoId: string) => {
    if (!selectedVehicle?.id) return;
    try {
      await VehiclePhotoService.definirFotoCapa(selectedVehicle.id, fotoId);
      await carregar();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível definir a foto de capa.');
    }
  };

  const handleExcluir = (foto: VehiclePhotoRecord) => {
    Alert.alert('Remover foto', 'Deseja remover esta foto da galeria do veículo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await VehiclePhotoService.excluirFoto(foto.id);
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
        <Text style={styles.headerTitle}>Fotos do veículo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ADICIONAR FOTO (ATÉ 1 MB COMPRIMIDA)</Text>
          <TextInput
            style={styles.input}
            value={legenda}
            onChangeText={setLegenda}
            placeholder="Legenda opcional (ex.: Frente, Lateral, Vistoria)"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => handleCapturar('camera')}
              disabled={capturing}
            >
              <Icon name="Camera" size={16} color={colors.background} />
              <Text style={styles.primaryBtnText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => handleCapturar('gallery')}
              disabled={capturing}
            >
              <Icon name="Image" size={16} color={colors.textPrimary} />
              <Text style={styles.secondaryBtnText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          {erro ? <Text style={styles.errorText}>{erro}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>GALERIA EM ORDEM CRONOLÓGICA ({fotos.length})</Text>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.lime} />
          </View>
        ) : fotos.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>
              Nenhuma foto registrada para este veículo ainda. Use a câmera ou galeria acima.
            </Text>
          </View>
        ) : (
          fotos.map(foto => {
            const isCapa = capaId === foto.id;
            const uri = foto.arquivo_local || foto.url_gcs || '';
            return (
              <View key={foto.id} style={styles.photoCard}>
                {uri ? <Image source={{ uri }} style={styles.photoPreview} resizeMode="cover" /> : null}
                <View style={styles.photoBody}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.photoCaption}>
                      {foto.legenda || 'Foto do veículo'}
                    </Text>
                    {isCapa ? (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>Capa</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.mutedText}>
                    {formatarDataColeta(foto.data)} ·{' '}
                    {foto.status_upload === 'enviado' ? 'Sincronizada' : 'Salva localmente'}
                  </Text>
                  <View style={styles.actionRow}>
                    {!isCapa ? (
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => handleDefinirCapa(foto.id)}
                      >
                        <Text style={styles.secondaryBtnText}>Definir como capa</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleExcluir(foto)}
                    >
                      <Text style={styles.deleteBtnText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
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
  actionRow: { flexDirection: 'row', gap: spacing.xs },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    height: 42,
  },
  primaryBtnText: { ...typography.captionBold, color: colors.background },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 42,
  },
  secondaryBtnText: { ...typography.captionBold, color: colors.textPrimary },
  deleteBtn: {
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { ...typography.caption, color: colors.error },
  errorText: { ...typography.caption, color: colors.error },
  mutedText: { ...typography.caption, color: colors.textSecondary },
  centerBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  photoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: 180, backgroundColor: colors.surface },
  photoBody: { padding: spacing.md, gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  photoCaption: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  coverBadge: {
    backgroundColor: colors.limeDim,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coverBadgeText: { ...typography.captionBold, color: colors.lime },
});
