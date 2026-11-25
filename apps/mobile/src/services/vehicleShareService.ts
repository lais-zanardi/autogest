import {
  PublicVehicleProfileResponse,
  VehicleShareCreatedResponse,
  VehicleShareSummary,
} from '@autogest/shared-types';
import { api } from './api';

/**
 * Extrai o token opaco de uma URL completa de perfil público ou devolve o próprio token.
 */
export function extrairTokenDeUrlPerfil(input: string): string {
  const limpo = String(input || '').trim();
  if (!limpo) return '';
  const match = /\/publico\/perfil\/([A-Za-z0-9_-]+)/.exec(limpo);
  return match ? match[1] : limpo;
}

/**
 * Gera uma matriz visual determinística 15x15 (QR simplificado em SVG) para exibição offline-safe
 * junto com a URL opaca copiável/compartilhável.
 */
export function gerarMatrizQrVisual(payload: string, size: number = 15): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        const border = r === 0 || r === 4 || c === 0 || c === 4;
        const center = r === 2 && c === 2;
        if (r0 + r < size && c0 + c < size) {
          matrix[r0 + r][c0 + c] = border || center;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 5);
  drawFinder(size - 5, 0);

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const inFinder =
        (r < 5 && c < 5) || (r < 5 && c >= size - 5) || (r >= size - 5 && c < 5);
      if (inFinder) continue;
      hash = Math.imul(hash ^ (r * 31 + c * 17), 16777619);
      matrix[r][c] = (hash & 1) === 1;
    }
  }

  return matrix;
}

/**
 * US20.5 — Serviço mobile de compartilhamento de perfil via QR Code e leitura de perfil público.
 */
export class VehicleShareService {
  static async gerarCompartilhamento(veiculoId: string): Promise<VehicleShareCreatedResponse> {
    const res = await api.post(`/api/v1/veiculos/${encodeURIComponent(veiculoId)}/compartilhamentos`);
    return res.data as VehicleShareCreatedResponse;
  }

  static async listarCompartilhamentos(veiculoId: string): Promise<VehicleShareSummary[]> {
    const res = await api.get(`/api/v1/veiculos/${encodeURIComponent(veiculoId)}/compartilhamentos`);
    return (res.data?.items || []) as VehicleShareSummary[];
  }

  static async revogarCompartilhamento(
    veiculoId: string,
    compartilhamentoId?: string,
  ): Promise<boolean> {
    const suffix = compartilhamentoId ? `/${encodeURIComponent(compartilhamentoId)}` : '';
    const res = await api.delete(
      `/api/v1/veiculos/${encodeURIComponent(veiculoId)}/compartilhamentos${suffix}`,
    );
    return Boolean(res.data?.revogado);
  }

  static async consultarPerfilPublico(
    tokenOuUrl: string,
  ): Promise<PublicVehicleProfileResponse> {
    const token = extrairTokenDeUrlPerfil(tokenOuUrl);
    if (!token) {
      throw new Error('Informe um código ou link de perfil válido.');
    }
    const res = await api.get(`/api/v1/publico/perfil/${encodeURIComponent(token)}`);
    return res.data as PublicVehicleProfileResponse;
  }
}
