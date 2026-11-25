import { MonthlySummaryMetrics } from '@autogest/shared-types';

const MESES_PT_BR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function formatarMoedaPtBr(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0,
  );
}

function formatarNumeroPtBr(valor: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(Number.isFinite(valor) ? valor : 0));
}

function formatarMesPtBr(mesIso: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(mesIso.trim());
  if (!match) return mesIso;
  const idx = parseInt(match[2], 10) - 1;
  return `${MESES_PT_BR[idx] || match[2]}/${match[1]}`;
}

function formatarConsumoPtBr(kml: number | null): string {
  if (kml === null || !Number.isFinite(kml) || kml <= 0) {
    return '--';
  }
  return `${kml.toFixed(1).replace('.', ',')} km/l`;
}

export interface ModeloEmailResumo {
  assunto: string;
  texto: string;
  html: string;
}

/**
 * US37.4: Gera modelo de e-mail em texto puro e HTML simples no padrão pt-BR,
 * contendo exclusivamente os indicadores mensais aprovados (gastos totais, consumo médio,
 * quilometragem percorrida) e o link de cancelamento.
 */
export function gerarModeloEmailResumoMensal(
  resumo: MonthlySummaryMetrics,
  linkCancelamento: string,
): ModeloEmailResumo {
  const mesFormatado = formatarMesPtBr(resumo.mesReferencia);
  const gastosTexto = formatarMoedaPtBr(resumo.gastosTotaisReais);
  const consumoTexto = formatarConsumoPtBr(resumo.consumoMedioKml);
  const kmTexto = `${formatarNumeroPtBr(resumo.kmPercorridos)} km`;

  const assunto = `AutoGest — Resumo mensal (${mesFormatado})`;

  const texto = [
    `Resumo mensal do seu veículo — ${mesFormatado}`,
    '',
    `Gastos totais: ${gastosTexto}`,
    `Consumo médio: ${consumoTexto}`,
    `Quilometragem percorrida: ${kmTexto}`,
    '',
    'Você recebeu este resumo porque ativou a opção no AutoGest.',
    `Para cancelar o recebimento a qualquer momento, acesse: ${linkCancelamento}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; background-color: #0F1113; color: #F0F1F2; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #181B1D; border-radius: 16px; padding: 24px; border: 1px solid #2A2E33;">
    <h2 style="margin-top: 0; color: #C6FF4D;">AutoGest · Resumo de ${mesFormatado}</h2>
    <p style="color: #8A9098;">Confira os principais indicadores consolidados do mês:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 10px 0; color: #8A9098; border-bottom: 1px solid #2A2E33;">Gastos totais</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold; border-bottom: 1px solid #2A2E33;">${gastosTexto}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #8A9098; border-bottom: 1px solid #2A2E33;">Consumo médio</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold; border-bottom: 1px solid #2A2E33;">${consumoTexto}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #8A9098;">Quilometragem percorrida</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold;">${kmTexto}</td>
      </tr>
    </table>
    <p style="font-size: 12px; color: #8A9098; margin-top: 24px;">
      Não deseja mais receber o resumo mensal?
      <a href="${linkCancelamento}" style="color: #C6FF4D;">Cancelar recebimento</a>.
    </p>
  </div>
</body>
</html>`;

  return { assunto, texto, html };
}
