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
  aplicarRestauracaoBackup,
  ErroRestauracaoBackup,
  lerEValidarBackupAgbak,
  listarBackupsLocaisSalvos,
  obterBackupLocalSalvo,
  ResultadoAplicacaoRestauracao,
  ResultadoInspecaoBackup,
} from '../backup';
import { colors, spacing, radius } from '../theme';
import { Icon } from '../components/Icon';

interface RestoreBackupScreenProps {
  onClose?: () => void;
}

const ENTITY_DISPLAY_LABELS: Record<string, string> = {
  veiculos: 'Veículos',
  abastecimentos: 'Abastecimentos',
  leituras_hodometro: 'Leituras de Hodômetro',
  despesas: 'Despesas',
  manutencoes: 'Manutenções',
  anexos: 'Anexos (Metadados)',
  regras_manutencao: 'Regras de Manutenção',
  custos_fixos: 'Custos Fixos',
  registros_pneu: 'Registros de Pneu',
  registros_fluido: 'Registros de Fluido',
  auditoria: 'Registros de Auditoria',
};

/**
 * US38.1, US38.2, US38.3, US38.4, US38.5, US38.6 & US38.7:
 * Tela "Dados e segurança › Restaurar backup (.agbak)"
 * - Seletor de arquivo `.agbak` e campo de senha;
 * - Leitura e validação em memória antes de tocar no banco;
 * - Mensagens distintas para arquivo inválido, versão não suportada, senha incorreta ou arquivo corrompido e outro usuário;
 * - Confirmação com resumo (data do backup e quantidade de registros por entidade) antes de aplicar;
 * - Aplicação por mesclagem em uma única transação atômica com recálculo de indicadores, alertas e auditoria.
 */
export const RestoreBackupScreen: React.FC<RestoreBackupScreenProps> = ({ onClose }) => {
  const { user } = useAppStore();

  const [savedFiles, setSavedFiles] = useState<
    Array<{ caminhoCompleto: string; nomeArquivo: string; tamanhoBytes: number }>
  >([]);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [password, setPassword] = useState('');

  const [isInspecting, setIsInspecting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorBanner, setErrorBanner] = useState<{
    codigo?: string;
    mensagem: string;
  } | null>(null);

  const [inspectionResult, setInspectionResult] = useState<ResultadoInspecaoBackup | null>(null);
  const [restoreResult, setRestoreResult] = useState<ResultadoAplicacaoRestauracao | null>(null);

  const refreshSavedFiles = useCallback(() => {
    const files = listarBackupsLocaisSalvos();
    setSavedFiles(files);
    if (files.length > 0 && !selectedFilePath) {
      setSelectedFilePath(files[0].caminhoCompleto);
    }
  }, [selectedFilePath]);

  useEffect(() => {
    refreshSavedFiles();
  }, [refreshSavedFiles]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
  };

  const handleInspectFile = () => {
    setErrorBanner(null);
    setInspectionResult(null);
    setRestoreResult(null);

    if (!selectedFilePath || !selectedFilePath.trim().endsWith('.agbak')) {
      setErrorBanner({
        codigo: 'ARQUIVO_INVALIDO',
        mensagem: 'Selecione um arquivo válido com extensão .agbak.',
      });
      return;
    }

    if (!password || !password.trim()) {
      setErrorBanner({
        codigo: 'SENHA_OU_ARQUIVO_CORROMPIDO',
        mensagem: 'Informe a senha do backup para decifrar o arquivo.',
      });
      return;
    }

    const fileBytes = obterBackupLocalSalvo(selectedFilePath.trim());
    if (!fileBytes) {
      setErrorBanner({
        codigo: 'ARQUIVO_INVALIDO',
        mensagem: 'Arquivo .agbak não encontrado no caminho informado ou sem permissão de leitura.',
      });
      return;
    }

    setIsInspecting(true);
    try {
      const currentUserId = user?.id || 'local_user';
      const inspecao = lerEValidarBackupAgbak({
        arquivoBytes: fileBytes,
        senha: password,
        usuarioAtualId: currentUserId,
      });
      setInspectionResult(inspecao);
    } catch (err: any) {
      if (err instanceof ErroRestauracaoBackup) {
        setErrorBanner({
          codigo: err.codigo,
          mensagem: err.message,
        });
      } else {
        setErrorBanner({
          mensagem: err?.message || 'Não foi possível validar o arquivo de backup.',
        });
      }
    } finally {
      setIsInspecting(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!inspectionResult) return;

    setErrorBanner(null);
    setIsApplying(true);

    try {
      const currentUserId = user?.id || 'local_user';
      const parts = selectedFilePath.split('/');
      const nomeArquivo = parts[parts.length - 1] || 'backup.agbak';

      const result = await aplicarRestauracaoBackup({
        payload: inspectionResult.payload,
        usuarioAtualId: currentUserId,
        nomeArquivo,
      });

      setPassword('');
      setInspectionResult(null);
      setRestoreResult(result);
    } catch (err: any) {
      if (err instanceof ErroRestauracaoBackup) {
        setErrorBanner({
          codigo: err.codigo,
          mensagem: err.message,
        });
      } else {
        setErrorBanner({
          mensagem:
            err?.message || 'Falha ao aplicar a restauração. Nenhuma alteração foi salva no banco.',
        });
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>DADOS E SEGURANÇA</Text>
            <Text style={styles.title}>Restaurar Backup (.agbak)</Text>
          </View>
          {onClose && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Fechar tela de restaurar backup"
            >
              <Icon name="X" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Card informativo de mesclagem segura */}
        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
            <Icon name="RefreshCw" size={16} color={colors.lime} />
            <Text style={[styles.infoTitle, { marginBottom: 0 }]}>Restauração por Mesclagem Segura</Text>
          </View>
          <Text style={styles.infoBody}>
            O arquivo é decifrado e validado em memória antes de qualquer gravação. Ao confirmar, os
            registros ausentes serão inseridos e, nos existentes, prevalecerá a versão mais recente
            (maior data de atualização). Em caso de erro, os dados atuais permanecem intactos.
          </Text>
        </View>

        {/* Seletor de arquivo .agbak (US38.1) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>ARQUIVO DE BACKUP (.AGBAK)</Text>

          <TouchableOpacity
            style={styles.filePickerBtn}
            onPress={() => {
              refreshSavedFiles();
              setShowFilePicker(prev => !prev);
            }}
            activeOpacity={0.8}
            accessibilityLabel="Selecionar arquivo .agbak no dispositivo"
          >
            <View style={styles.filePickerInfo}>
              <Text style={styles.filePickerTitle}>
                {selectedFilePath ? selectedFilePath : 'Nenhum arquivo .agbak selecionado'}
              </Text>
              <Text style={styles.filePickerSub}>
                Toque para escolher um backup salvo no dispositivo
              </Text>
            </View>
            <Text style={styles.filePickerAction}>Escolher</Text>
          </TouchableOpacity>

          {showFilePicker && (
            <View style={styles.savedFilesList}>
              {savedFiles.length === 0 ? (
                <Text style={styles.emptyFilesText}>
                  Nenhum arquivo .agbak gerado nesta sessão. Informe o caminho abaixo ou crie um
                  backup antes.
                </Text>
              ) : (
                savedFiles.map(file => {
                  const isSelected = file.caminhoCompleto === selectedFilePath;
                  return (
                    <TouchableOpacity
                      key={file.caminhoCompleto}
                      style={[styles.savedFileOption, isSelected && styles.savedFileOptionSelected]}
                      onPress={() => {
                        setSelectedFilePath(file.caminhoCompleto);
                        setShowFilePicker(false);
                        setInspectionResult(null);
                        setRestoreResult(null);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon
                          name="Package"
                          size={15}
                          color={isSelected ? colors.black : colors.textSecondary}
                        />
                        <Text
                          style={[styles.savedFileName, isSelected && styles.savedFileNameSelected]}
                        >
                          {file.nomeArquivo} ({file.tamanhoBytes} B)
                        </Text>
                      </View>
                      <Text style={styles.savedFilePath}>{file.caminhoCompleto}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          <Text style={styles.inputLabel}>Caminho do arquivo (.agbak)</Text>
          <TextInput
            style={styles.input}
            value={selectedFilePath}
            onChangeText={text => {
              setSelectedFilePath(text);
              setInspectionResult(null);
            }}
            placeholder="/storage/emulated/0/Download/AutoGest/autogest-20261105-1845.agbak"
            placeholderTextColor={colors.textMuted}
            editable={!isInspecting && !isApplying}
            accessibilityLabel="Caminho do arquivo .agbak"
          />
        </View>

        {/* Senha do backup (US38.1) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>SENHA DO ARQUIVO</Text>
          <Text style={styles.inputLabel}>Senha usada na criação do backup</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={text => {
              setPassword(text);
              setInspectionResult(null);
            }}
            placeholder="Digite a senha do arquivo .agbak"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            editable={!isInspecting && !isApplying}
            accessibilityLabel="Senha para decifrar o backup"
          />
        </View>

        {/* Banner de erro tipado (US38.2 & US38.6) */}
        {errorBanner && (
          <View style={styles.errorBanner} accessibilityLabel="erro-restauracao-backup">
            {errorBanner.codigo && (
              <Text style={styles.errorCodeBadge}>Código: {errorBanner.codigo}</Text>
            )}
            <Text style={styles.errorText}>{errorBanner.mensagem}</Text>
          </View>
        )}

        {/* Botão para ler e validar em memória antes de confirmar */}
        {!inspectionResult && (
          <TouchableOpacity
            style={[styles.primaryBtn, (isInspecting || isApplying) && styles.primaryBtnDisabled]}
            onPress={handleInspectFile}
            disabled={isInspecting || isApplying}
            activeOpacity={0.85}
            accessibilityLabel="Validar e inspecionar arquivo .agbak"
          >
            {isInspecting ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="Search" size={16} color={colors.black} />
                <Text style={styles.primaryBtnText}>Validar e Ler Resumo do Backup</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Card de Confirmação com Resumo (US38.4) */}
        {inspectionResult && (
          <View style={styles.confirmCard} accessibilityLabel="resumo-confirmacao-restauracao">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
              <Icon name="FileText" size={16} color={colors.lime} />
              <Text style={[styles.confirmTitle, { marginBottom: 0 }]}>Confirmação de Restauração</Text>
            </View>
            <Text style={styles.confirmSubtitle}>
              Backup validado em memória com sucesso. Confira o resumo abaixo antes de aplicar:
            </Text>

            <View style={styles.metaBox}>
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Data do backup: </Text>
                {formatDateTime(inspectionResult.resumo.geradoEm)}
              </Text>
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Conta proprietária: </Text>
                {inspectionResult.resumo.usuarioId}
              </Text>
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Total de registros: </Text>
                {inspectionResult.resumo.totalRegistros}
              </Text>
            </View>

            <Text style={styles.entityBreakdownTitle}>Registros por entidade:</Text>
            <View style={styles.entityGrid}>
              {Object.entries(inspectionResult.resumo.contagemPorEntidade).map(([ent, count]) => (
                <View key={ent} style={styles.entityRow}>
                  <Text style={styles.entityName}>{ENTITY_DISPLAY_LABELS[ent] || ent}</Text>
                  <Text style={styles.entityCount}>{count}</Text>
                </View>
              ))}
            </View>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setInspectionResult(null)}
                disabled={isApplying}
                accessibilityLabel="Cancelar restauração"
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmApplyBtn, isApplying && styles.primaryBtnDisabled]}
                onPress={handleConfirmRestore}
                disabled={isApplying}
                accessibilityLabel="Confirmar e restaurar dados"
              >
                {isApplying ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="CheckCircle2" size={16} color={colors.black} />
                    <Text style={styles.confirmApplyBtnText}>Confirmar e Restaurar</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Card de Sucesso após aplicar a restauração (US38.5 & US38.7) */}
        {restoreResult && (
          <View style={styles.successCard} accessibilityLabel="resultado-restauracao-concluida">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
              <Icon name="CheckCircle2" size={16} color={colors.lime} />
              <Text style={[styles.successTitle, { marginBottom: 0 }]}>Backup restaurado com sucesso</Text>
            </View>
            <Text style={styles.successMeta}>
              Registros novos inseridos: {restoreResult.inseridos}
            </Text>
            <Text style={styles.successMeta}>
              Registros atualizados (versão mais recente no backup): {restoreResult.atualizados}
            </Text>
            <Text style={styles.successMeta}>
              Registros preservados (versão local mais recente ou igual):{' '}
              {restoreResult.ignoradosPorVersaoLocalMaisRecente}
            </Text>
            <Text style={styles.successMeta}>
              Enfileirados para sincronização em nuvem: {restoreResult.enfileiradosNoSync}
            </Text>
          </View>
        )}
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
    paddingBottom: spacing.xxl,
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
    color: colors.lime,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  filePickerInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  filePickerTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  filePickerSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  filePickerAction: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: '700',
  },
  savedFilesList: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: 8,
  },
  emptyFilesText: {
    color: colors.textMuted,
    fontSize: 12,
    paddingVertical: 6,
  },
  savedFileOption: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  savedFileOptionSelected: {
    borderColor: colors.lime,
  },
  savedFileName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  savedFileNameSelected: {
    color: colors.lime,
  },
  savedFilePath: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorCodeBadge: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmCard: {
    backgroundColor: colors.card,
    borderColor: colors.lime,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  confirmTitle: {
    color: colors.lime,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  confirmSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  metaBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  metaLine: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  entityBreakdownTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  entityGrid: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: 6,
  },
  entityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entityName: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  entityCount: {
    color: colors.lime,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cancelBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmApplyBtn: {
    flex: 2,
    backgroundColor: colors.lime,
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmApplyBtnText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: colors.limeGlow,
    borderColor: colors.lime,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successTitle: {
    color: colors.lime,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  successMeta: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
  },
});
