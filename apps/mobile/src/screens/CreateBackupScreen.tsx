import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import {
  contarAnexosPendentesUpload,
  criarBackupLocal,
  gerarNomeArquivoBackup,
  ResultadoCriacaoBackupLocal,
} from '../backup';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';

const ANDROID_FOLDERS = [
  {
    id: 'downloads',
    label: 'Downloads › AutoGest',
    path: '/storage/emulated/0/Download/AutoGest',
  },
  {
    id: 'documents',
    label: 'Documentos › AutoGest Backups',
    path: '/storage/emulated/0/Documents/AutoGest/Backups',
  },
  {
    id: 'app_media',
    label: 'Armazenamento Interno › AutoGest',
    path: '/storage/emulated/0/Android/media/com.autogest/Backups',
  },
];

interface CreateBackupScreenProps {
  onClose?: () => void;
}

/**
 * US21.4: Tela "Dados e segurança › Criar backup"
 * - Senha com confirmação e aviso de que sem ela não há recuperação;
 * - Aviso sobre anexos pendentes de upload (somente metadados `url_gcs` entram no backup);
 * - Seletor de pasta do Android e nome padrão `autogest-AAAAMMDD-HHmm.agbak`;
 * - Indicador de progresso durante derivação PBKDF2-HMAC-SHA256 e cifragem AES-256-GCM.
 */
export const CreateBackupScreen: React.FC<CreateBackupScreenProps> = ({ onClose }) => {
  const { user } = useAppStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(ANDROID_FOLDERS[0].path);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState(0);
  const [previewFileName, setPreviewFileName] = useState(() => gerarNomeArquivoBackup(new Date()));

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<ResultadoCriacaoBackupLocal | null>(null);

  const loadPendingInfo = useCallback(async () => {
    try {
      const count = await contarAnexosPendentesUpload();
      setPendingAttachments(count);
      setPreviewFileName(gerarNomeArquivoBackup(new Date()));
    } catch {
      setPendingAttachments(0);
    }
  }, []);

  useEffect(() => {
    loadPendingInfo();
  }, [loadPendingInfo]);

  const handleCreateBackup = async () => {
    setErrorMessage(null);
    setBackupResult(null);

    if (!password || password.trim().length < 6) {
      setErrorMessage('Informe uma senha com pelo menos 6 caracteres para proteger o backup.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação de senha não coincide com a senha informada.');
      return;
    }

    setIsGenerating(true);
    setProgressStage(
      'Derivando chave criptográfica (PBKDF2-HMAC-SHA256) e cifrando com AES-256-GCM...',
    );

    try {
      const result = await criarBackupLocal({
        usuarioId: user?.id || 'local_user',
        senha: password,
        diretorioDestino: selectedFolder,
      });

      // Nunca guarda a senha após concluir
      setPassword('');
      setConfirmPassword('');
      setBackupResult(result);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível gerar o backup local.');
    } finally {
      setIsGenerating(false);
      setProgressStage('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>DADOS E SEGURANÇA</Text>
            <Text style={styles.title}>Criar Backup Local (.agbak)</Text>
          </View>
          {onClose && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Fechar tela de criar backup"
            >
              <Icon name="X" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Aviso crítico de segurança sobre a senha */}
        <View style={styles.warningCard} accessibilityLabel="aviso-sem-recuperacao-senha">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
            <Icon name="AlertTriangle" size={16} color={colors.amber} />
            <Text style={[styles.warningTitle, { marginBottom: 0 }]}>Atenção: Sem a senha não há recuperação</Text>
          </View>
          <Text style={styles.warningBody}>
            O arquivo .agbak é cifrado localmente com AES-256-GCM. A sua senha e a chave de
            criptografia nunca são salvas no aparelho nem enviadas ao servidor. Caso esqueça a
            senha, não será possível restaurar este arquivo.
          </Text>
        </View>

        {/* Aviso de anexos pendentes de upload (US21.3) */}
        <View style={styles.infoCard} accessibilityLabel="aviso-anexos-metadados">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
            <Icon name="Paperclip" size={16} color={colors.lime} />
            <Text style={[styles.infoTitle, { marginBottom: 0 }]}>Anexos e Comprovantes</Text>
          </View>
          <Text style={styles.infoBody}>
            Os anexos entram no backup apenas como metadados (URL na nuvem).
            {pendingAttachments > 0
              ? ` Atenção: você possui ${pendingAttachments} ${
                  pendingAttachments === 1 ? 'anexo pendente' : 'anexos pendentes'
                } de upload que ainda não têm URL na nuvem.`
              : ' Todos os seus anexos atuais já estão sincronizados na nuvem.'}
          </Text>
        </View>

        {/* Seletor de Pasta do Android e Nome do Arquivo */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>LOCAL DE GRAVAÇÃO NO ANDROID</Text>
          <TouchableOpacity
            style={styles.folderSelectorBtn}
            onPress={() => setShowFolderPicker(prev => !prev)}
            activeOpacity={0.8}
            accessibilityLabel="Selecionar pasta de destino no Android"
          >
            <View style={styles.folderInfoCol}>
              <Text style={styles.folderPathText}>{selectedFolder}</Text>
              <Text style={styles.fileNamePreviewText}>Arquivo: {previewFileName}</Text>
            </View>
            <Text style={styles.folderChangeLabel}>Alterar pasta</Text>
          </TouchableOpacity>

          {showFolderPicker && (
            <View style={styles.folderOptionsList}>
              {ANDROID_FOLDERS.map(folder => {
                const isSelected = folder.path === selectedFolder;
                return (
                  <TouchableOpacity
                    key={folder.id}
                    style={[styles.folderOption, isSelected && styles.folderOptionSelected]}
                    onPress={() => {
                      setSelectedFolder(folder.path);
                      setShowFolderPicker(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon
                        name="Folder"
                        size={15}
                        color={isSelected ? colors.black : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.folderOptionLabel,
                          isSelected && styles.folderOptionLabelSelected,
                        ]}
                      >
                        {folder.label}
                      </Text>
                    </View>
                    <Text style={styles.folderOptionSub}>{folder.path}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Campos de Senha e Confirmação */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>SENHA DE CRIPTOGRAFIA DO BACKUP</Text>

          <Text style={styles.inputLabel}>Senha do backup</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo de 6 caracteres"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            editable={!isGenerating}
            accessibilityLabel="Senha do backup"
          />

          <Text style={styles.inputLabel}>Confirmar senha do backup</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a senha exatamente"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            editable={!isGenerating}
            accessibilityLabel="Confirmar senha do backup"
          />
        </View>

        {/* Mensagem de erro */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Indicador de progresso */}
        {isGenerating && (
          <View style={styles.progressBox} accessibilityLabel="indicador-progresso-backup">
            <ActivityIndicator size="small" color={colors.lime} />
            <Text style={styles.progressText}>{progressStage}</Text>
          </View>
        )}

        {/* Resultado de sucesso */}
        {backupResult && (
          <View style={styles.successCard} accessibilityLabel="resumo-backup-gerado">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
              <Icon name="CheckCircle2" size={16} color={colors.lime} />
              <Text style={[styles.successTitle, { marginBottom: 0 }]}>Backup cifrado gerado com sucesso</Text>
            </View>
            <Text style={styles.successDetail}>Arquivo: {backupResult.nomeArquivo}</Text>
            <Text style={styles.successDetail}>Local: {backupResult.caminhoCompleto}</Text>
            <Text style={styles.successDetail}>
              Tamanho: {backupResult.arquivoBytes.length} bytes • Registros exportados:{' '}
              {backupResult.totalRegistros}
            </Text>
          </View>
        )}

        {/* Botão primário */}
        <TouchableOpacity
          style={[styles.primaryBtn, isGenerating && styles.primaryBtnDisabled]}
          onPress={handleCreateBackup}
          disabled={isGenerating}
          activeOpacity={0.85}
          accessibilityLabel="Gerar arquivo de backup cifrado"
        >
          <Text style={styles.primaryBtnText}>
            {isGenerating ? 'Cifrando e gravando backup...' : 'Gerar Backup Cifrado (.agbak)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerTextCol: {
    flex: 1,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    marginBottom: 4,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  warningCard: {
    backgroundColor: colors.amberDim,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.amber,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningTitle: {
    ...typography.bodyBold,
    color: colors.amber,
    marginBottom: 4,
  },
  warningBody: {
    ...typography.caption,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  infoBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  folderSelectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  folderInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  folderPathText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  fileNamePreviewText: {
    ...typography.caption,
    color: colors.lime,
    marginTop: 4,
    fontSize: 11,
  },
  folderChangeLabel: {
    ...typography.captionBold,
    color: colors.lime,
  },
  folderOptionsList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  folderOption: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  folderOptionSelected: {
    borderColor: colors.lime,
    backgroundColor: colors.limeGlow,
  },
  folderOptionLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  folderOptionLabelSelected: {
    color: colors.lime,
  },
  folderOptionSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(224, 90, 90, 0.14)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.captionBold,
    color: colors.error,
  },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  progressText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  successCard: {
    backgroundColor: colors.limeGlow,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lime,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successTitle: {
    ...typography.bodyBold,
    color: colors.lime,
    marginBottom: 4,
  },
  successDetail: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
});
