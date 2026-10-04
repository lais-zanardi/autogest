import AsyncStorage from '@react-native-async-storage/async-storage';
import { CreateRefuelDTO } from '@autogest/shared-types';

const OFFLINE_QUEUE_KEY = '@autogest:pending_refuels';

export class OfflineStorage {
  static async getPendingRefuels(): Promise<CreateRefuelDTO[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async savePendingRefuel(refuel: CreateRefuelDTO): Promise<void> {
    try {
      const currentQueue = await this.getPendingRefuels();
      currentQueue.push(refuel);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(currentQueue));
    } catch (e) {
      console.error('Erro ao salvar abastecimento em armazenamento offline local', e);
    }
  }

  static async clearPendingRefuels(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch (e) {
      console.error('Erro ao limpar fila offline', e);
    }
  }
}
