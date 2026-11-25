import { MonthlySummaryMetrics } from '@autogest/shared-types';
import { pool } from '../models/db';
import { ProvedorEmail, ResendEmailProvider } from '../integracoes/email';
import { gerarModeloEmailResumoMensal } from '../services/monthlySummaryTemplate';
import {
  gerarTokenOpacoSeguro,
  hashTokenOpaco,
} from '../services/publicProfileDomain';

export interface MonthlySummaryRecipient {
  usuarioId: string;
  emailDestino: string;
  metricas: MonthlySummaryMetrics;
}

export interface MonthlySummaryRepository {
  listarElegiveisParaMes(mesReferencia: string): Promise<MonthlySummaryRecipient[]>;
  jaEnviadoNoMes(usuarioId: string, mesReferencia: string): Promise<boolean>;
  registrarEnvio(usuarioId: string, mesReferencia: string): Promise<void>;
  salvarTokenCancelamentoHash(usuarioId: string, tokenHash: string): Promise<void>;
  desativarPorTokenHash(tokenHash: string): Promise<boolean>;
}

interface SeededUserSummary {
  usuarioId: string;
  receberResumo: boolean;
  emailDestino: string;
  gastosTotaisReais: number;
  consumoMedioKml: number | null;
  kmPercorridos: number;
  tokenCancelamentoHash?: string | null;
}

export class InMemoryMonthlySummaryRepository implements MonthlySummaryRepository {
  private users: SeededUserSummary[] = [];
  private sentKeys = new Set<string>();

  seedUserSummary(data: SeededUserSummary) {
    this.users.push({ ...data, tokenCancelamentoHash: null });
  }

  async listarElegiveisParaMes(mesReferencia: string): Promise<MonthlySummaryRecipient[]> {
    return this.users
      .filter(u => u.receberResumo && u.emailDestino && u.emailDestino.includes('@'))
      .map(u => ({
        usuarioId: u.usuarioId,
        emailDestino: u.emailDestino,
        metricas: {
          mesReferencia,
          gastosTotaisReais: u.gastosTotaisReais,
          consumoMedioKml: u.consumoMedioKml,
          kmPercorridos: u.kmPercorridos,
        },
      }));
  }

  async jaEnviadoNoMes(usuarioId: string, mesReferencia: string): Promise<boolean> {
    return this.sentKeys.has(`${usuarioId}|${mesReferencia}`);
  }

  async registrarEnvio(usuarioId: string, mesReferencia: string): Promise<void> {
    this.sentKeys.add(`${usuarioId}|${mesReferencia}`);
  }

  async salvarTokenCancelamentoHash(usuarioId: string, tokenHash: string): Promise<void> {
    const user = this.users.find(u => u.usuarioId === usuarioId);
    if (user) {
      user.tokenCancelamentoHash = tokenHash;
    }
  }

  async desativarPorTokenHash(tokenHash: string): Promise<boolean> {
    const user = this.users.find(u => u.tokenCancelamentoHash === tokenHash);
    if (!user) return false;
    user.receberResumo = false;
    return true;
  }
}

export class PostgresMonthlySummaryRepository implements MonthlySummaryRepository {
  async listarElegiveisParaMes(mesReferencia: string): Promise<MonthlySummaryRecipient[]> {
    const inicio = `${mesReferencia}-01`;
    const { rows } = await pool.query(
      `SELECT pr.usuario_id, pr.email_destino,
              COALESCE((
                SELECT SUM(a.valor_total) FROM abastecimentos a
                JOIN veiculos v ON v.id = a.veiculo_id
                WHERE v.usuario_id = pr.usuario_id AND a.excluido_em IS NULL
                  AND TO_CHAR(a.data_hora, 'YYYY-MM') = $1
              ), 0) +
              COALESCE((
                SELECT SUM(d.valor) FROM despesas d
                JOIN veiculos v ON v.id = d.veiculo_id
                WHERE v.usuario_id = pr.usuario_id AND d.excluido_em IS NULL
                  AND TO_CHAR(d.data_hora, 'YYYY-MM') = $1
              ), 0) +
              COALESCE((
                SELECT SUM(m.valor) FROM manutencoes m
                JOIN veiculos v ON v.id = m.veiculo_id
                WHERE v.usuario_id = pr.usuario_id AND m.excluido_em IS NULL
                  AND TO_CHAR(m.data, 'YYYY-MM') = $1
              ), 0) AS gastos_totais,
              (
                SELECT AVG(a.consumo_kml) FROM abastecimentos a
                JOIN veiculos v ON v.id = a.veiculo_id
                WHERE v.usuario_id = pr.usuario_id AND a.excluido_em IS NULL
                  AND a.consumo_kml IS NOT NULL AND a.consumo_kml > 0
                  AND TO_CHAR(a.data_hora, 'YYYY-MM') = $1
              ) AS consumo_medio,
              COALESCE((
                SELECT MAX(l.km) - MIN(l.km) FROM leituras_hodometro l
                JOIN veiculos v ON v.id = l.veiculo_id
                WHERE v.usuario_id = pr.usuario_id AND l.excluido_em IS NULL
                  AND TO_CHAR(l.data_hora, 'YYYY-MM') = $1
              ), 0) AS km_percorridos
       FROM preferencias_resumo pr
       WHERE pr.receber_resumo = TRUE
         AND pr.excluido_em IS NULL
         AND pr.email_destino <> ''
         AND $2::date IS NOT NULL`,
      [mesReferencia, inicio],
    );

    return rows.map(r => ({
      usuarioId: r.usuario_id,
      emailDestino: r.email_destino,
      metricas: {
        mesReferencia,
        gastosTotaisReais: Number(r.gastos_totais || 0),
        consumoMedioKml: r.consumo_medio !== null ? Number(r.consumo_medio) : null,
        kmPercorridos: Math.max(0, Number(r.km_percorridos || 0)),
      },
    }));
  }

  async jaEnviadoNoMes(usuarioId: string, mesReferencia: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT 1 FROM envios_resumo_mensal WHERE usuario_id = $1 AND mes_referencia = $2 LIMIT 1',
      [usuarioId, mesReferencia],
    );
    return rows.length > 0;
  }

  async registrarEnvio(usuarioId: string, mesReferencia: string): Promise<void> {
    await pool.query(
      `INSERT INTO envios_resumo_mensal (usuario_id, mes_referencia)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, mes_referencia) DO NOTHING`,
      [usuarioId, mesReferencia],
    );
  }

  async salvarTokenCancelamentoHash(usuarioId: string, tokenHash: string): Promise<void> {
    await pool.query(
      'UPDATE preferencias_resumo SET token_cancelamento_hash = $1, atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = $2',
      [tokenHash, usuarioId],
    );
  }

  async desativarPorTokenHash(tokenHash: string): Promise<boolean> {
    const res = await pool.query(
      'UPDATE preferencias_resumo SET receber_resumo = FALSE, atualizado_em = CURRENT_TIMESTAMP WHERE token_cancelamento_hash = $1',
      [tokenHash],
    );
    return (res.rowCount || 0) > 0;
  }
}

export interface ResultadoJobResumoMensal {
  mesReferencia: string;
  enviados: number;
  ignoradosJaEnviados: number;
  erros: number;
}

/**
 * US37.3 & US37.5 — Job mensal idempotente que envia o resumo por e-mail
 * apenas para usuários com consentimento explícito (`receber_resumo = true`).
 */
export class ResumoMensalEmailJob {
  private readonly provedor: ProvedorEmail;
  private readonly repo: MonthlySummaryRepository;
  private readonly baseUrl: string;

  constructor(
    provedor: ProvedorEmail = new ResendEmailProvider(),
    repo: MonthlySummaryRepository = new PostgresMonthlySummaryRepository(),
    baseUrl: string = process.env.PUBLIC_API_BASE_URL || 'https://api.autogest.app',
  ) {
    this.provedor = provedor;
    this.repo = repo;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async executar(mesReferencia: string): Promise<ResultadoJobResumoMensal> {
    const elegiveis = await this.repo.listarElegiveisParaMes(mesReferencia);
    let enviados = 0;
    let ignoradosJaEnviados = 0;
    let erros = 0;

    for (const item of elegiveis) {
      const jaEnviado = await this.repo.jaEnviadoNoMes(item.usuarioId, mesReferencia);
      if (jaEnviado) {
        ignoradosJaEnviados += 1;
        continue;
      }

      try {
        const cancelToken = gerarTokenOpacoSeguro();
        const cancelHash = hashTokenOpaco(cancelToken);
        await this.repo.salvarTokenCancelamentoHash(item.usuarioId, cancelHash);

        const linkCancelamento = `${this.baseUrl}/api/v1/publico/resumo/cancelar/${cancelToken}`;
        const modelo = gerarModeloEmailResumoMensal(item.metricas, linkCancelamento);

        await this.provedor.enviar({
          to: item.emailDestino,
          subject: modelo.assunto,
          text: modelo.texto,
          html: modelo.html,
        });

        await this.repo.registrarEnvio(item.usuarioId, mesReferencia);
        enviados += 1;
      } catch (err) {
        console.error('[ResumoMensalEmailJob] Erro ao enviar resumo mensal:', err);
        erros += 1;
      }
    }

    return {
      mesReferencia,
      enviados,
      ignoradosJaEnviados,
      erros,
    };
  }
}

/**
 * Retorna o mês de referência anterior no formato "AAAA-MM".
 * Ex.: Em 01/11/2026, retorna "2026-10".
 */
export function calcularMesReferenciaAnterior(dataReferencia: Date = new Date()): string {
  const d = new Date(dataReferencia.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

const UMA_HORA_MS = 60 * 60 * 1000;

/**
 * Agendamento automático periódico do resumo mensal por e-mail:
 * Verifica a cada hora se é o primeiro dia do mês (dia 1) às 08h e dispara o fechamento do mês anterior.
 * Retorna uma função para cancelar o agendamento (ideal para testes e graceful shutdown).
 */
export function agendarJobResumoMensalEmail(
  job: ResumoMensalEmailJob = new ResumoMensalEmailJob(),
  intervaloMs: number = UMA_HORA_MS,
  nowFn: () => Date = () => new Date(),
): () => void {
  const verificarEDisparar = async () => {
    const agora = nowFn();
    // Executa no dia 1 de cada mês no horário das 08h
    if (agora.getDate() === 1 && agora.getHours() === 8) {
      const mesAnterior = calcularMesReferenciaAnterior(agora);
      try {
        console.log(`[ResumoMensalEmailJob] Disparando fechamento mensal para o mês ${mesAnterior}...`);
        const res = await job.executar(mesAnterior);
        console.log(
          `[ResumoMensalEmailJob] Fechamento ${mesAnterior} concluído: ${res.enviados} enviados, ${res.ignoradosJaEnviados} já enviados, ${res.erros} erros.`,
        );
      } catch (err) {
        console.error('[ResumoMensalEmailJob] Falha no fechamento automático mensal:', err);
      }
    }
  };

  const timer = setInterval(verificarEDisparar, intervaloMs);
  if (typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }

  return () => clearInterval(timer);
}
