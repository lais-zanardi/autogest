import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Linking,
  Alert,
  Switch,
} from 'react-native';
import { WorkshopDetailSummary, WorkshopRecord } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { WorkshopService } from '../services/workshopService';
import { montarUrlLigacaoTelefone } from '../services/workshopValidation';
import { formatarDataColeta, formatarMoeda } from '../utils/formatters';

interface WorkshopsScreenProps {
  onClose: () => void;
}

export const WorkshopsScreen: React.FC<WorkshopsScreenProps> = ({ onClose }) => {
  const [oficinas, setOficinas] = useState<WorkshopRecord[]>([]);
  const [apenasFavoritas, setApenasFavoritas] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<WorkshopDetailSummary | null>(null);

  // Campos do formulário
  const [nome, setNome] = useState<string>('');
  const [telefone, setTelefone] = useState<string>('');
  const [endereco, setEndereco] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [favorita, setFavorita] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const carregarLista = useCallback(async (onlyFavs: boolean) => {
    setLoading(true);
    try {
      const lista = await WorkshopService.listarOficinas(onlyFavs);
      setOficinas(lista);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarLista(apenasFavoritas);
  }, [apenasFavoritas, carregarLista]);

  const abrirFormulario = (oficina?: WorkshopRecord) => {
    setFormError(null);
    if (oficina) {
      setEditingId(oficina.id);
      setNome(oficina.nome);
      setTelefone(oficina.telefone || '');
      setEndereco(oficina.endereco || '');
      setObservacoes(oficina.observacoes || '');
      setFavorita(oficina.favorita);
    } else {
      setEditingId(null);
      setNome('');
      setTelefone('');
      setEndereco('');
      setObservacoes('');
      setFavorita(false);
    }
    setDetalhe(null);
    setShowForm(true);
  };

  const handleSalvar = async () => {
    setFormError(null);
    setSaving(true);
    try {
      if (editingId) {
        await WorkshopService.atualizarOficina(editingId, {
          nome,
          telefone: telefone || null,
          endereco: endereco || null,
          observacoes: observacoes || null,
          favorita,
        });
      } else {
        await WorkshopService.criarOficina({
          nome,
          telefone: telefone || null,
          endereco: endereco || null,
          observacoes: observacoes || null,
          favorita,
        });
      }
      setShowForm(false);
      await carregarLista(apenasFavoritas);
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível salvar a oficina.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavorita = async (id: string) => {
    await WorkshopService.alternarFavorita(id);
    await carregarLista(apenasFavoritas);
    if (detalhe?.oficina.id === id) {
      const updated = await WorkshopService.obterDetalheOficina(id);
      setDetalhe(updated);
    }
  };

  const handleLigar = async (tel?: string | null) => {
    const url = montarUrlLigacaoTelefone(tel);
    if (!url) {
      Alert.alert('Telefone indisponível', 'Esta oficina não possui telefone válido cadastrado.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Discador indisponível', 'Não foi possível iniciar a ligação neste aparelho.');
    }
  };

  const handleAbrirDetalhe = async (id: string) => {
    const summary = await WorkshopService.obterDetalheOficina(id);
    setDetalhe(summary);
    setShowForm(false);
  };

  const handleExcluir = (oficina: WorkshopRecord) => {
    Alert.alert(
      'Remover oficina',
      `Deseja remover "${oficina.nome}"? O histórico de manutenções e atendimentos será preservado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await WorkshopService.excluirOficina(oficina.id);
            setDetalhe(null);
            await carregarLista(apenasFavoritas);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (showForm || detalhe) {
              setShowForm(false);
              setDetalhe(null);
            } else {
              onClose();
            }
          }}
          style={styles.iconButton}
          accessibilityLabel="Voltar"
        >
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {showForm
            ? editingId
              ? 'Editar oficina'
              : 'Nova oficina'
            : detalhe
              ? 'Detalhes da oficina'
              : 'Oficinas favoritas'}
        </Text>
        {!showForm && !detalhe ? (
          <TouchableOpacity
            onPress={() => abrirFormulario()}
            style={styles.iconButton}
            accessibilityLabel="Adicionar oficina"
          >
            <Icon name="Plus" size={20} color={colors.lime} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>NOME DA OFICINA *</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex.: Auto Center Paulista"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>TELEFONE (COM DDD)</Text>
            <TextInput
              style={styles.input}
              value={telefone}
              onChangeText={setTelefone}
              keyboardType="phone-pad"
              placeholder="(11) 98765-4321"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>ENDEREÇO</Text>
            <TextInput
              style={styles.input}
              value={endereco}
              onChangeText={setEndereco}
              placeholder="Rua, número e bairro"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>OBSERVAÇÕES</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Especialidades, horários ou mecânico de referência"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <View style={styles.switchRow}>
              <Text style={styles.bodyText}>Marcar como favorita</Text>
              <Switch
                value={favorita}
                onValueChange={setFavorita}
                trackColor={{ false: colors.surfaceRaised, true: colors.limeDim }}
                thumbColor={favorita ? colors.lime : colors.textMuted}
              />
            </View>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSalvar}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? 'Salvando...' : 'Salvar oficina'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : detalhe ? (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.detailTitle}>{detalhe.oficina.nome}</Text>
                <TouchableOpacity onPress={() => handleToggleFavorita(detalhe.oficina.id)}>
                  <Icon
                    name="Star"
                    size={20}
                    color={detalhe.oficina.favorita ? colors.lime : colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {detalhe.oficina.endereco ? (
                <Text style={styles.mutedText}>{detalhe.oficina.endereco}</Text>
              ) : null}
              {detalhe.oficina.observacoes ? (
                <Text style={styles.mutedText}>{detalhe.oficina.observacoes}</Text>
              ) : null}

              <View style={styles.totalBox}>
                <Text style={styles.sectionLabel}>TOTAL GASTO NESTA OFICINA</Text>
                <Text style={styles.totalValue}>{formatarMoeda(detalhe.totalGastoReais)}</Text>
              </View>

              <View style={styles.actionRow}>
                {detalhe.oficina.telefone ? (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => handleLigar(detalhe.oficina.telefone)}
                  >
                    <Icon name="Phone" size={15} color={colors.background} />
                    <Text style={styles.callBtnText}>Ligar</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => abrirFormulario(detalhe.oficina)}
                >
                  <Text style={styles.secondaryBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={() => handleExcluir(detalhe.oficina)}
                >
                  <Text style={styles.dangerBtnText}>Remover</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionLabel}>HISTÓRICO DE ATENDIMENTOS</Text>
            <View style={styles.card}>
              {detalhe.atendimentos.length === 0 ? (
                <Text style={styles.mutedText}>
                  Nenhum atendimento vinculado a esta oficina ainda.
                </Text>
              ) : (
                detalhe.atendimentos.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[
                      styles.visitRow,
                      idx === detalhe.atendimentos.length - 1 && styles.visitRowLast,
                    ]}
                  >
                    <View style={styles.visitLeft}>
                      <Text style={styles.bodyBoldText}>{item.descricaoManutencao}</Text>
                      <Text style={styles.mutedText}>{formatarDataColeta(item.data)}</Text>
                    </View>
                    <Text style={styles.visitPrice}>{formatarMoeda(item.valorReais)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !apenasFavoritas && styles.filterChipActive]}
                onPress={() => setApenasFavoritas(false)}
              >
                <Text
                  style={[styles.filterChipText, !apenasFavoritas && styles.filterChipTextActive]}
                >
                  Todas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, apenasFavoritas && styles.filterChipActive]}
                onPress={() => setApenasFavoritas(true)}
              >
                <Text
                  style={[styles.filterChipText, apenasFavoritas && styles.filterChipTextActive]}
                >
                  Favoritas
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.lime} />
              </View>
            ) : oficinas.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.bodyBoldText}>Nenhuma oficina cadastrada</Text>
                <Text style={styles.mutedText}>
                  Salve suas oficinas de confiança com telefone, endereço e acompanhe o total gasto.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => abrirFormulario()}>
                  <Text style={styles.primaryBtnText}>Cadastrar oficina</Text>
                </TouchableOpacity>
              </View>
            ) : (
              oficinas.map(oficina => (
                <TouchableOpacity
                  key={oficina.id}
                  style={styles.card}
                  onPress={() => handleAbrirDetalhe(oficina.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.bodyBoldText}>{oficina.nome}</Text>
                    <TouchableOpacity onPress={() => handleToggleFavorita(oficina.id)}>
                      <Icon
                        name="Star"
                        size={18}
                        color={oficina.favorita ? colors.lime : colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  {oficina.endereco ? (
                    <Text style={styles.mutedText}>{oficina.endereco}</Text>
                  ) : null}
                  <View style={styles.rowBetween}>
                    <Text style={styles.mutedText}>
                      {oficina.telefone || 'Sem telefone cadastrado'}
                    </Text>
                    {oficina.telefone ? (
                      <TouchableOpacity
                        style={styles.callChip}
                        onPress={() => handleLigar(oficina.telefone)}
                      >
                        <Icon name="Phone" size={13} color={colors.background} />
                        <Text style={styles.callChipText}>Ligar</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
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
  fieldLabel: { ...typography.sectionLabel, color: colors.textMuted, marginTop: 4 },
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
  textArea: { height: 84, textAlignVertical: 'top', paddingTop: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  bodyText: { ...typography.body, color: colors.textPrimary },
  bodyBoldText: { ...typography.bodyBold, color: colors.textPrimary },
  mutedText: { ...typography.caption, color: colors.textSecondary },
  errorText: { ...typography.caption, color: colors.error },
  primaryBtn: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnText: { ...typography.captionBold, color: colors.background },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.limeDim, borderColor: colors.lime },
  filterChipText: { ...typography.caption, color: colors.textSecondary },
  filterChipTextActive: { ...typography.captionBold, color: colors.lime },
  centerBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  callChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lime,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  callChipText: { ...typography.captionBold, color: colors.background },
  detailTitle: { ...typography.h2, color: colors.textPrimary, flex: 1 },
  totalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  totalValue: { ...typography.h1, color: colors.lime },
  actionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  callBtnText: { ...typography.captionBold, color: colors.background },
  secondaryBtn: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { ...typography.captionBold, color: colors.textPrimary },
  dangerBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  dangerBtnText: { ...typography.captionBold, color: colors.error },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  visitRowLast: { borderBottomWidth: 0 },
  visitLeft: { flex: 1, gap: 2 },
  visitPrice: { ...typography.bodyBold, color: colors.textPrimary },
});
