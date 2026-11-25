import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EmailMessage, ProvedorEmail } from '../integracoes/email';
import { gerarModeloEmailResumoMensal } from '../services/monthlySummaryTemplate';
import {
  InMemoryMonthlySummaryRepository,
  ResumoMensalEmailJob,
  agendarJobResumoMensalEmail,
  calcularMesReferenciaAnterior,
} from '../jobs/resumoMensalEmailJob';
import { MonthlySummaryController } from '../controllers/monthlySummaryController';

describe('US37 — Resumo Mensal por E-mail (Job, Idempotência, Consentimento, Cancelamento e Privacidade)', () => {
  let repo: InMemoryMonthlySummaryRepository;
  let sentEmails: EmailMessage[];
  let fakeEmailProvider: ProvedorEmail;

  beforeEach(() => {
    repo = new InMemoryMonthlySummaryRepository();
    sentEmails = [];
    fakeEmailProvider = {
      async enviar(msg: EmailMessage) {
        sentEmails.push(msg);
        return { messageId: `msg_${sentEmails.length}` };
      },
    };

    repo.seedUserSummary({
      usuarioId: 'user-consent-1',
      receberResumo: true,
      emailDestino: 'motorista@exemplo.com',
      gastosTotaisReais: 1250.5,
      consumoMedioKml: 12.5,
      kmPercorridos: 900,
    });

    repo.seedUserSummary({
      usuarioId: 'user-no-consent-2',
      receberResumo: false,
      emailDestino: 'semconsentimento@exemplo.com',
      gastosTotaisReais: 800,
      consumoMedioKml: 11.0,
      kmPercorridos: 500,
    });

    MonthlySummaryController.setRepository(repo);
  });

  it('US37.3, US37.4 & US37.6: envia e-mail em texto e HTML pt-BR apenas para quem consentiu e sem dados sensíveis', async () => {
    const job = new ResumoMensalEmailJob(fakeEmailProvider, repo);
    const res = await job.executar('2026-10');

    assert.strictEqual(res.enviados, 1);
    assert.strictEqual(res.ignoradosJaEnviados, 0);
    assert.strictEqual(sentEmails.length, 1);

    const email = sentEmails[0];
    assert.strictEqual(email.to, 'motorista@exemplo.com');
    assert.ok(email.text.includes('1.250,50'));
    assert.ok(email.text.includes('12,5 km/l'));
    assert.ok(email.text.includes('900 km'));
    assert.ok(email.html.includes('1.250,50'));
    assert.ok(email.html.includes('/api/v1/publico/resumo/cancelar/'));

    // Nenhum dado sensível como usuario_id aparece no corpo ou URL
    assert.ok(!email.text.includes('user-consent-1'));
    assert.ok(!email.html.includes('user-consent-1'));
  });

  it('US37.5 & US37.6: idempotência por mês impede duplicação mesmo se o job for reexecutado', async () => {
    const job = new ResumoMensalEmailJob(fakeEmailProvider, repo);

    const first = await job.executar('2026-10');
    assert.strictEqual(first.enviados, 1);

    const second = await job.executar('2026-10');
    assert.strictEqual(second.enviados, 0);
    assert.strictEqual(second.ignoradosJaEnviados, 1);
    assert.strictEqual(sentEmails.length, 1);

    // No mês seguinte envia normalmente
    const nextMonth = await job.executar('2026-11');
    assert.strictEqual(nextMonth.enviados, 1);
    assert.strictEqual(sentEmails.length, 2);
  });

  it('US37.4 & US37.6: cancelamento pelo link desativa o envio para os próximos meses', async () => {
    const job = new ResumoMensalEmailJob(fakeEmailProvider, repo);
    await job.executar('2026-10');

    const match = /\/api\/v1\/publico\/resumo\/cancelar\/([A-Za-z0-9_-]+)/.exec(sentEmails[0].text);
    assert.ok(match, 'Link de cancelamento deve estar presente no e-mail');
    const cancelToken = match[1];

    let statusCode = 0;
    let body: any = null;
    const req: any = { params: { token: cancelToken } };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        body = payload;
        return this;
      },
    };

    await MonthlySummaryController.cancelarPorLink(req, res, (err: any) => {
      throw err;
    });

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(body.cancelado, true);

    // No mês seguinte não envia mais para este usuário
    const nov = await job.executar('2026-11');
    assert.strictEqual(nov.enviados, 0);
    assert.strictEqual(sentEmails.length, 1);
  });

  it('US37.4: modelo de e-mail trata consumo nulo como "--" sem NaN', () => {
    const tpl = gerarModeloEmailResumoMensal(
      {
        mesReferencia: '2026-10',
        gastosTotaisReais: 0,
        consumoMedioKml: null,
        kmPercorridos: 0,
      },
      'https://api.autogest.app/api/v1/publico/resumo/cancelar/abc',
    );
    assert.ok(tpl.texto.includes('--'));
    assert.ok(!tpl.texto.includes('NaN'));
  });

  it('US37.3: calcularMesReferenciaAnterior e agendarJobResumoMensalEmail disparam no primeiro dia do mês às 08h', async () => {
    // 01/11/2026 -> mês anterior = 2026-10
    const d1 = new Date(2026, 10, 1, 8, 0, 0); // Nov é índice 10
    assert.strictEqual(calcularMesReferenciaAnterior(d1), '2026-10');

    // 01/01/2027 -> mês anterior = 2026-12 (virada de ano)
    const dVirada = new Date(2027, 0, 1, 8, 0, 0); // Jan é índice 0
    assert.strictEqual(calcularMesReferenciaAnterior(dVirada), '2026-12');

    let chamadasExecutar = 0;
    const fakeJob = {
      async executar(mes: string) {
        chamadasExecutar += 1;
        assert.strictEqual(mes, '2026-10');
        return { mesReferencia: mes, enviados: 1, ignoradosJaEnviados: 0, erros: 0 };
      },
    } as any;

    const cancelar = agendarJobResumoMensalEmail(fakeJob, 5, () => new Date(2026, 10, 1, 8, 0, 0));
    await new Promise(r => setTimeout(r, 20));
    cancelar();
    assert.ok(chamadasExecutar >= 1);
  });
});
