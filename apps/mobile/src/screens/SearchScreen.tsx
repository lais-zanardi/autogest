import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  UnifiedRecord,
  SearchFilters,
  Tag,
} from '@autogest/shared-types';
import { useTheme, typography } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { SearchRepository } from '../repositories/SearchRepository';
import { TagService } from '../services/tagService';
import { obterIdCurto } from '../services/searchFilterService';
import { AdvancedFilterModal } from '../components/AdvancedFilterModal';
import { VehicleHeaderSelector } from '../components/VehicleHeaderSelector';
import { formatCurrency } from '../utils/formatters';

interface SearchScreenProps {
  onClose?: () => void;
  onSelectRecord?: (record: UnifiedRecord) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ onClose, onSelectRecord }) => {
  const { colors } = useTheme();
  const selectedVehicle = useAppStore(state => state.selectedVehicle);

  const [texto, setTexto] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<UnifiedRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag[]>>({});
  const [modalFiltersVisible, setModalFiltersVisible] = useState(false);

  // Carrega lista de etiquetas disponíveis
  useEffect(() => {
    TagService.listarEtiquetas()
      .then(setAvailableTags)
      .catch(() => {});
  }, []);

  // Busca inicial ou alteração de filtros / veículo / texto
  const executarBusca = useCallback(
    async (novaPagina = 1, append = false) => {
      if (!selectedVehicle?.id) {
        setResults([]);
        setTotalRecords(0);
        return;
      }

      if (novaPagina === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const filtrosCompletos: SearchFilters = {
          ...filters,
          vehicleId: selectedVehicle.id,
          texto: texto.trim() || null,
        };

        const res = await SearchRepository.buscarRegistros(filtrosCompletos, {
          page: novaPagina,
          limit: 15,
        });

        if (append) {
          setResults(prev => [...prev, ...res.records]);
        } else {
          setResults(res.records);
        }

        setTotalRecords(res.total);
        setPage(res.page);
        setHasNextPage(res.hasNextPage);

        // Carrega tags dos novos registros
        const ids = res.records.map(r => r.id);
        if (ids.length > 0) {
          const mapRefuels = await TagService.obterMapaTagsRegistros('abastecimento', ids);
          const mapExpenses = await TagService.obterMapaTagsRegistros('despesa', ids);
          const mapMaints = await TagService.obterMapaTagsRegistros('manutencao', ids);
          setTagsMap(prev => ({ ...prev, ...mapRefuels, ...mapExpenses, ...mapMaints }));
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível realizar a busca.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedVehicle?.id, filters, texto],
  );

  useEffect(() => {
    executarBusca(1, false);
  }, [executarBusca]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasNextPage) {
      executarBusca(page + 1, true);
    }
  };

  const handleLimparFiltros = () => {
    setTexto('');
    setFilters({});
  };

  // Contagem de filtros avançados ativos
  const activeFiltersChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.recordType && filters.recordType !== 'todos') {
      chips.push({
        key: 'tipo',
        label: `Tipo: ${filters.recordType}`,
        onRemove: () => setFilters(prev => ({ ...prev, recordType: 'todos' })),
      });
    }

    if (filters.dataInicio || filters.dataFim) {
      chips.push({
        key: 'periodo',
        label: `${filters.dataInicio || 'início'} até ${filters.dataFim || 'hoje'}`,
        onRemove: () => setFilters(prev => ({ ...prev, dataInicio: null, dataFim: null })),
      });
    }

    if (filters.valorMin !== null && filters.valorMin !== undefined) {
      chips.push({
        key: 'valMin',
        label: `>= R$ ${filters.valorMin}`,
        onRemove: () => setFilters(prev => ({ ...prev, valorMin: null })),
      });
    }

    if (filters.valorMax !== null && filters.valorMax !== undefined) {
      chips.push({
        key: 'valMax',
        label: `<= R$ ${filters.valorMax}`,
        onRemove: () => setFilters(prev => ({ ...prev, valorMax: null })),
      });
    }

    if (filters.kmMin !== null && filters.kmMin !== undefined) {
      chips.push({
        key: 'kmMin',
        label: `>= ${filters.kmMin} km`,
        onRemove: () => setFilters(prev => ({ ...prev, kmMin: null })),
      });
    }

    if (filters.kmMax !== null && filters.kmMax !== undefined) {
      chips.push({
        key: 'kmMax',
        label: `<= ${filters.kmMax} km`,
        onRemove: () => setFilters(prev => ({ ...prev, kmMax: null })),
      });
    }

    if (filters.routeType && filters.routeType !== 'todos') {
      chips.push({
        key: 'rota',
        label: `Rota: ${filters.routeType}`,
        onRemove: () => setFilters(prev => ({ ...prev, routeType: 'todos' })),
      });
    }

    if (filters.tagId) {
      const tagObj = availableTags.find(t => t.id === filters.tagId);
      chips.push({
        key: 'tag',
        label: `🏷️ ${tagObj?.name || tagObj?.nome || 'Etiqueta'}`,
        onRemove: () => setFilters(prev => ({ ...prev, tagId: null })),
      });
    }

    return chips;
  }, [filters, availableTags]);

  const renderItem = ({ item }: { item: UnifiedRecord }) => {
    const shortId = obterIdCurto(item.id);
    const itemTags = tagsMap[item.id] || [];

    const icon =
      item.recordType === 'abastecimento'
        ? '⛽'
        : item.recordType === 'manutencao'
          ? '🔧'
          : '💸';

    return (
      <TouchableOpacity
        style={[styles.recordCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onSelectRecord?.(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardIcon}>{icon}</Text>
            <View>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {new Date(item.date).toLocaleDateString('pt-BR')} • {item.recordType}
              </Text>
            </View>
          </View>

          <View style={styles.cardHeaderRight}>
            <Text style={[typography.bodyBold, { color: colors.lime }]}>
              {formatCurrency(item.amount)}
            </Text>
            {/* US33.4: ID curto (8 primeiros caracteres do UUID) */}
            <Text style={[styles.shortIdBadge, { color: colors.textMuted }]}>
              ID: {shortId}
            </Text>
          </View>
        </View>

        {/* Detalhes específicos */}
        <View style={styles.cardDetails}>
          {item.odometer ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Odômetro: {item.odometer.toLocaleString('pt-BR')} km
            </Text>
          ) : null}

          {item.workshop ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Oficina: {item.workshop}
            </Text>
          ) : null}

          {item.parts ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Peças: {item.parts}
            </Text>
          ) : null}

          {item.notes ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Nota: {item.notes}
            </Text>
          ) : null}
        </View>

        {/* Chips de Etiquetas e Percurso */}
        <View style={styles.cardChipsRow}>
          {item.routeType && (
            <View
              style={[
                styles.itemChip,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.itemChipText, { color: colors.lime }]}>
                {item.routeType === 'urbano'
                  ? '🏙️ Urbano'
                  : item.routeType === 'rodoviario'
                    ? '🛣️ Rodoviário'
                    : '🔀 Misto'}
              </Text>
            </View>
          )}

          {itemTags.map(tag => (
            <View
              key={tag.id}
              style={[
                styles.itemChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.itemChipText, { color: colors.textSecondary }]}>
                🏷️ {tag.name || tag.nome}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.titleCol}>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>Buscar & Filtros</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Pesquisa unificada em abastecimentos, despesas e manutenções
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.closeBtnText, { color: colors.textPrimary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Seletor de Veículo Ativo */}
      <VehicleHeaderSelector />

      {/* Barra de Busca e Botão de Filtros */}
      <View style={styles.searchBarRow}>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar por descrição, oficina, notas ou ID..."
            placeholderTextColor={colors.textSecondary}
            value={texto}
            onChangeText={setTexto}
            returnKeyType="search"
            onSubmitEditing={() => executarBusca(1, false)}
          />
          {texto.length > 0 && (
            <TouchableOpacity onPress={() => setTexto('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterTriggerBtn,
            {
              backgroundColor: activeFiltersChips.length > 0 ? colors.lime : colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setModalFiltersVisible(true)}
          accessibilityLabel="Abrir filtros avançados"
        >
          <Text
            style={[
              styles.filterTriggerText,
              { color: activeFiltersChips.length > 0 ? colors.black : colors.textPrimary },
            ]}
          >
            ⚙️ {activeFiltersChips.length > 0 ? `(${activeFiltersChips.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chips de Filtros Ativos com Botão Limpar */}
      {activeFiltersChips.length > 0 && (
        <View style={styles.activeFiltersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {activeFiltersChips.map(chip => (
              <View
                key={chip.key}
                style={[
                  styles.activeChip,
                  { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: colors.textPrimary }]}>
                  {chip.label}
                </Text>
                <TouchableOpacity onPress={chip.onRemove} style={styles.removeChipBtn}>
                  <Text style={[styles.removeChipText, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.clearAllBtn} onPress={handleLimparFiltros}>
              <Text style={[styles.clearAllText, { color: colors.error }]}>Limpar todos</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Indicador de Quantidade de Registros */}
      <View style={styles.resultStatsRow}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {loading ? 'Buscando registros...' : `${totalRecords} registro(s) encontrado(s)`}
        </Text>
      </View>

      {/* Lista de Resultados Paginada */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.lime} />
        </View>
      ) : results.length === 0 ? (
        /* US33.3: Estado sem resultados */
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8 }]}>
            Nenhum registro encontrado
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 32 }]}>
            Tente remover alguns filtros ou buscar por outro termo ou identificador.
          </Text>
          {(activeFiltersChips.length > 0 || texto.length > 0) && (
            <TouchableOpacity
              style={[styles.emptyResetBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              onPress={handleLimparFiltros}
            >
              <Text style={[typography.bodyBold, { color: colors.lime }]}>Limpar Busca e Filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.moreLoading}>
                <ActivityIndicator size="small" color={colors.lime} />
              </View>
            ) : null
          }
        />
      )}

      {/* Modal de Filtros Avançados */}
      <AdvancedFilterModal
        visible={modalFiltersVisible}
        filters={filters}
        tags={availableTags}
        onClose={() => setModalFiltersVisible(false)}
        onApply={newFilters => {
          setFilters(newFilters);
        }}
        onReset={() => {
          setFilters({});
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  titleCol: {
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchBarRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearIcon: {
    fontSize: 14,
    padding: 4,
  },
  filterTriggerBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTriggerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  activeFiltersRow: {
    paddingVertical: 4,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  activeChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  removeChipBtn: {
    marginLeft: 6,
    padding: 2,
  },
  removeChipText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  clearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: {
    ...typography.caption,
    fontWeight: '700',
  },
  resultStatsRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  recordCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  shortIdBadge: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cardDetails: {
    marginTop: 6,
    gap: 2,
  },
  cardChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  itemChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemChipText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyResetBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  moreLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
