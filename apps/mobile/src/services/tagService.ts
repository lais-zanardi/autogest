import { Tag, RecordType } from '@autogest/shared-types';
import { TagRepository } from '../repositories/TagRepository';

export class TagService {
  /**
   * Obtém uma etiqueta pelo nome (insensível a maiúsculas/minúsculas) ou a cria se não existir.
   */
  static async obterOuCriarEtiqueta(nome: string): Promise<Tag> {
    const nomeLimpo = (nome || '').trim();
    if (!nomeLimpo) {
      throw new Error('O nome da etiqueta não pode ser vazio.');
    }

    const existente = await TagRepository.findByName(nomeLimpo);
    if (existente) {
      return existente;
    }

    const nova = await TagRepository.create({ name: nomeLimpo });
    return nova;
  }

  /**
   * Lista todas as etiquetas ativas.
   */
  static async listarEtiquetas(): Promise<Tag[]> {
    return TagRepository.listAll();
  }

  /**
   * Exclui uma etiqueta e seus vínculos polimórficos.
   */
  static async excluirEtiqueta(id: string): Promise<boolean> {
    return TagRepository.delete(id);
  }

  /**
   * Vincula a lista de IDs de etiquetas ao registro especificado.
   */
  static async vincularEtiquetas(
    tipoRegistro: RecordType,
    registroId: string,
    tagIds: string[],
  ): Promise<void> {
    await TagRepository.setRecordTags(tipoRegistro, registroId, tagIds);
  }

  /**
   * Lista etiquetas vinculadas a um registro específico.
   */
  static async listarEtiquetasDoRegistro(
    tipoRegistro: RecordType,
    registroId: string,
  ): Promise<Tag[]> {
    return TagRepository.listByRecord(tipoRegistro, registroId);
  }

  /**
   * Obtém mapa de etiquetas por ID de registro (em lote para históricos).
   */
  static async obterMapaTagsRegistros(
    tipoRegistro: RecordType,
    registroIds: string[],
  ): Promise<Record<string, Tag[]>> {
    return TagRepository.listByRecords(tipoRegistro, registroIds);
  }
}
