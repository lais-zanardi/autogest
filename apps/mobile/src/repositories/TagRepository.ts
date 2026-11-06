import { Tag, CreateTagDTO, RecordTag, RecordType } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

export class TagRepository {
  private static TABLE_TAGS = 'etiquetas';
  private static TABLE_RECORD_TAGS = 'registros_etiquetas';

  // --- ETIQUETAS ---

  static async listAll(): Promise<Tag[]> {
    const list = await db.getTableData<Tag>(this.TABLE_TAGS);
    return list
      .filter(t => !t.deletedAt && !t.excluido_em)
      .map(t => ({
        ...t,
        name: t.name || t.nome || '',
        nome: t.nome || t.name || '',
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }

  static async findById(id: string): Promise<Tag | null> {
    const item = await db.findById<Tag>(this.TABLE_TAGS, id);
    if (!item || item.deletedAt || item.excluido_em) return null;
    return {
      ...item,
      name: item.name || item.nome || '',
      nome: item.nome || item.name || '',
    };
  }

  static async findByName(name: string): Promise<Tag | null> {
    const normalized = name.trim().toLowerCase();
    const all = await this.listAll();
    const found = all.find(t => (t.name || t.nome || '').trim().toLowerCase() === normalized);
    return found || null;
  }

  static async create(dto: CreateTagDTO): Promise<Tag> {
    const now = new Date().toISOString();
    const rawName = (dto.name || dto.nome || '').trim();
    const id = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const tag: Tag = {
      id,
      name: rawName,
      nome: rawName,
      userId: dto.userId || dto.usuario_id || 'local_user',
      usuario_id: dto.usuario_id || dto.userId || 'local_user',
      createdAt: now,
      criado_em: now,
      updatedAt: now,
      atualizado_em: now,
      deletedAt: null,
      excluido_em: null,
    };

    await db.insert(this.TABLE_TAGS, tag);
    return tag;
  }

  static async delete(id: string): Promise<boolean> {
    const tag = await this.findById(id);
    if (!tag) return false;

    const now = new Date().toISOString();
    await db.update<any>(this.TABLE_TAGS, id, {
      deletedAt: now,
      excluido_em: now,
      updatedAt: now,
      atualizado_em: now,
    });

    // Remove todos os vínculos da etiqueta (cascade lógico)
    const allLinks = await db.getTableData<RecordTag>(this.TABLE_RECORD_TAGS);
    const affected = allLinks.filter(
      l => (l.tagId === id || l.etiqueta_id === id) && !l.deletedAt && !l.excluido_em,
    );

    for (const link of affected) {
      await db.update<any>(this.TABLE_RECORD_TAGS, link.id, {
        deletedAt: now,
        excluido_em: now,
        updatedAt: now,
        atualizado_em: now,
      });
    }

    return true;
  }

  // --- VÍNCULOS POLIMÓRFICOS ---

  static async listByRecord(recordType: RecordType, recordId: string): Promise<Tag[]> {
    const allLinks = await db.getTableData<RecordTag>(this.TABLE_RECORD_TAGS);
    const validLinks = allLinks.filter(
      l =>
        !l.deletedAt &&
        !l.excluido_em &&
        (l.recordType === recordType || l.tipo_registro === recordType) &&
        (l.recordId === recordId || l.registro_id === recordId),
    );

    if (validLinks.length === 0) return [];

    const tagIds = new Set(validLinks.map(l => l.tagId || l.etiqueta_id || ''));
    const allTags = await this.listAll();
    return allTags.filter(t => tagIds.has(t.id));
  }

  static async listByRecords(
    recordType: RecordType,
    recordIds: string[],
  ): Promise<Record<string, Tag[]>> {
    const recordIdSet = new Set(recordIds);
    const allLinks = await db.getTableData<RecordTag>(this.TABLE_RECORD_TAGS);
    const validLinks = allLinks.filter(
      l =>
        !l.deletedAt &&
        !l.excluido_em &&
        (l.recordType === recordType || l.tipo_registro === recordType) &&
        recordIdSet.has(l.recordId || l.registro_id || ''),
    );

    const allTags = await this.listAll();
    const tagMap = new Map<string, Tag>(allTags.map(t => [t.id, t]));

    const result: Record<string, Tag[]> = {};
    for (const id of recordIds) {
      result[id] = [];
    }

    for (const link of validLinks) {
      const regId = link.recordId || link.registro_id || '';
      const tagId = link.tagId || link.etiqueta_id || '';
      const tag = tagMap.get(tagId);
      if (tag && result[regId]) {
        result[regId].push(tag);
      }
    }

    return result;
  }

  static async setRecordTags(
    recordType: RecordType,
    recordId: string,
    tagIds: string[],
  ): Promise<void> {
    const now = new Date().toISOString();
    const allLinks = await db.getTableData<RecordTag>(this.TABLE_RECORD_TAGS);
    const existing = allLinks.filter(
      l =>
        !l.deletedAt &&
        !l.excluido_em &&
        (l.recordType === recordType || l.tipo_registro === recordType) &&
        (l.recordId === recordId || l.registro_id === recordId),
    );

    const existingTagIds = new Set(existing.map(l => l.tagId || l.etiqueta_id || ''));
    const newTagIds = new Set(tagIds);

    // Desativa os que não estão mais
    for (const link of existing) {
      const currentTagId = link.tagId || link.etiqueta_id || '';
      if (!newTagIds.has(currentTagId)) {
        await db.update<any>(this.TABLE_RECORD_TAGS, link.id, {
          deletedAt: now,
          excluido_em: now,
          updatedAt: now,
          atualizado_em: now,
        });
      }
    }

    // Adiciona os novos
    for (const tagId of tagIds) {
      if (!existingTagIds.has(tagId)) {
        const id = `rtag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const recordTag: RecordTag = {
          id,
          tagId,
          etiqueta_id: tagId,
          recordType,
          tipo_registro: recordType,
          recordId,
          registro_id: recordId,
          userId: 'local_user',
          usuario_id: 'local_user',
          createdAt: now,
          criado_em: now,
          updatedAt: now,
          atualizado_em: now,
          deletedAt: null,
          excluido_em: null,
        };
        await db.insert(this.TABLE_RECORD_TAGS, recordTag);
      }
    }
  }
}
