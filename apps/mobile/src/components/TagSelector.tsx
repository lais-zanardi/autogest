import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Tag } from '@autogest/shared-types';
import { TagService } from '../services/tagService';
import { useTheme, typography } from '../theme';

interface TagSelectorProps {
  selectedTagIds: string[];
  onChangeSelectedTagIds: (ids: string[]) => void;
  label?: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTagIds,
  onChangeSelectedTagIds,
  label = 'Etiquetas',
}) => {
  const { colors } = useTheme();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [inputText, setInputText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    carregarEtiquetas();
  }, []);

  const carregarEtiquetas = async () => {
    try {
      const list = await TagService.listarEtiquetas();
      setAllTags(list);
    } catch {
      // Ignore
    }
  };

  const handleAddTag = async (tagName: string) => {
    const limpo = tagName.trim();
    if (!limpo) return;

    try {
      const tag = await TagService.obterOuCriarEtiqueta(limpo);
      if (!allTags.some(t => t.id === tag.id)) {
        setAllTags(prev => [...prev, tag]);
      }
      if (!selectedTagIds.includes(tag.id)) {
        onChangeSelectedTagIds([...selectedTagIds, tag.id]);
      }
      setInputText('');
      setShowSuggestions(false);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível adicionar a etiqueta.');
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChangeSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
  };

  const handleDeleteTagGlobally = (tag: Tag) => {
    Alert.alert(
      'Excluir Etiqueta',
      `Deseja realmente excluir a etiqueta "${tag.name || tag.nome}"? Ela será desvinculada de todos os registros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await TagService.excluirEtiqueta(tag.id);
              setAllTags(prev => prev.filter(t => t.id !== tag.id));
              onChangeSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir a etiqueta.');
            }
          },
        },
      ],
    );
  };

  const filteredSuggestions = allTags.filter(t => {
    const name = (t.name || t.nome || '').toLowerCase();
    const query = inputText.trim().toLowerCase();
    return query.length > 0 && name.includes(query) && !selectedTagIds.includes(t.id);
  });

  const selectedTags = allTags.filter(t => selectedTagIds.includes(t.id));

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}

      {/* Chips de tags selecionadas */}
      {selectedTags.length > 0 && (
        <View style={styles.chipsContainer}>
          {selectedTags.map(tag => (
            <View
              key={tag.id}
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.textPrimary }]}>
                {tag.name || tag.nome}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveTag(tag.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.chipRemoveBtn}
                accessibilityLabel={`Remover etiqueta ${tag.name || tag.nome}`}
              >
                <Text style={[styles.chipRemoveText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input de adição e busca com autocomplete */}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder="Adicionar etiqueta (ex: Trabalho, Viagem)"
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={text => {
            setInputText(text);
            setShowSuggestions(true);
          }}
          onSubmitEditing={() => handleAddTag(inputText)}
          returnKeyType="done"
        />
        {inputText.trim().length > 0 && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.lime }]}
            onPress={() => handleAddTag(inputText)}
            accessibilityLabel="Criar etiqueta"
          >
            <Text style={styles.addBtnText}>+ Adicionar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de sugestões de autocomplete */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
            {filteredSuggestions.map(tag => (
              <View
                key={tag.id}
                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleAddTag(tag.name || tag.nome || '')}
                >
                  <Text style={[styles.suggestionText, { color: colors.textPrimary }]}>
                    {tag.name || tag.nome}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteTagGlobally(tag)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={[styles.suggestionDeleteText, { color: colors.error }]}>
                    Excluir
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '500',
  },
  chipRemoveBtn: {
    marginLeft: 6,
    padding: 2,
  },
  chipRemoveText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addBtn: {
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 13,
  },
  suggestionsBox: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    ...typography.body,
    fontSize: 14,
  },
  suggestionDeleteText: {
    ...typography.caption,
    fontSize: 12,
  },
});
