import {
  CustoViagemResult,
  EconomiaPotencialResult,
  EtanolGasolinaResult,
} from '@autogest/shared-types';
import { formatarMoeda } from '../utils/formatters';

/**
 * US16.1 — Regra dos 70% (Decisão #5):
 * Etanol compensa se `precoEtanol <= 0,70 * precoGasolina` (valores em centavos inteiros).
 * A comparação usa aritmética inteira (`precoEtanol * 100 <= precoGasolina * 70`)
 * para eliminar imprecisão de ponto flutuante na borda de 70%.
 */
export function compararEtanolGasolina(
  precoEtanolCentavos: number,
  precoGasolinaCentavos: number,
): EtanolGasolinaResult {
  if (
    !Number.isFinite(precoEtanolCentavos) ||
    !Number.isFinite(precoGasolinaCentavos) ||
    precoEtanolCentavos <= 0 ||
    precoGasolinaCentavos <= 0
  ) {
    throw new Error('Os preços de etanol e gasolina devem ser maiores que zero.');
  }

  const etanolInt = Math.round(precoEtanolCentavos);
  const gasolinaInt = Math.round(precoGasolinaCentavos);

  const etanolCompensa = etanolInt * 100 <= gasolinaInt * 70;
  const razaoPercentual = Number(((etanolInt / gasolinaInt) * 100).toFixed(1));
  const diferencaPercentual = Number((razaoPercentual - 70).toFixed(1));
  const pontoEquilibrioCentavos = Math.floor((gasolinaInt * 70) / 100);

  const pctTexto = Number.isInteger(razaoPercentual)
    ? String(razaoPercentual)
    : razaoPercentual.toFixed(1).replace('.', ',');

  const mensagem = etanolCompensa
    ? `Compensa abastecer com etanol: custo ${pctTexto}% do da gasolina`
    : `Compensa abastecer com gasolina: etanol custa ${pctTexto}% do da gasolina`;

  return {
    decisao: etanolCompensa ? 'etanol' : 'gasolina',
    etanolCompensa,
    razaoPercentual,
    diferencaPercentual,
    pontoEquilibrioCentavos,
    mensagem,
  };
}

/**
 * US16.2 — Calcula custo mensal estimado nas duas opções e economia potencial (em centavos).
 * Protegida contra consumo zero ou negativo (não divide por zero).
 */
export function custoEconomiaPotencial(
  consumoAtualKml: number,
  consumoAlternativoKml: number,
  precoAtualCentavos: number,
  precoAlternativoCentavos: number,
  kmMes: number,
): EconomiaPotencialResult {
  if (
    !Number.isFinite(consumoAtualKml) ||
    !Number.isFinite(consumoAlternativoKml) ||
    consumoAtualKml <= 0 ||
    consumoAlternativoKml <= 0
  ) {
    throw new Error('O consumo informado deve ser maior que zero.');
  }
  if (
    !Number.isFinite(precoAtualCentavos) ||
    !Number.isFinite(precoAlternativoCentavos) ||
    precoAtualCentavos <= 0 ||
    precoAlternativoCentavos <= 0
  ) {
    throw new Error('Os preços por litro devem ser maiores que zero.');
  }
  if (!Number.isFinite(kmMes) || kmMes <= 0) {
    throw new Error('A quilometragem mensal deve ser maior que zero.');
  }

  const custoMensalAtualCentavos = Math.round((kmMes / consumoAtualKml) * precoAtualCentavos);
  const custoMensalAlternativoCentavos = Math.round(
    (kmMes / consumoAlternativoKml) * precoAlternativoCentavos,
  );
  const economiaMensalCentavos = custoMensalAtualCentavos - custoMensalAlternativoCentavos;
  const economiaAnualCentavos = economiaMensalCentavos * 12;
  const alternativaCompensa = economiaMensalCentavos > 0;

  const mensagem = alternativaCompensa
    ? `Economia potencial de ${formatarMoeda(economiaMensalCentavos / 100)} por mês (${formatarMoeda(economiaAnualCentavos / 100)}/ano).`
    : economiaMensalCentavos === 0
      ? 'As duas opções têm o mesmo custo mensal estimado.'
      : `A opção alternativa custaria ${formatarMoeda(Math.abs(economiaMensalCentavos) / 100)} a mais por mês.`;

  return {
    custoMensalAtualCentavos,
    custoMensalAlternativoCentavos,
    economiaMensalCentavos,
    economiaAnualCentavos,
    alternativaCompensa,
    mensagem,
  };
}

/**
 * US16.3 — Calcula o custo total previsto e custo por km de uma viagem (em centavos).
 * Protegida contra consumo zero ou distância inválida.
 */
export function custoPrevistoViagem(
  distanciaKm: number,
  consumoKml: number,
  precoLitroCentavos: number,
  pedagiosCentavos: number = 0,
  alimentacaoCentavos: number = 0,
): CustoViagemResult {
  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) {
    throw new Error('A distância da viagem deve ser maior que zero.');
  }
  if (!Number.isFinite(consumoKml) || consumoKml <= 0) {
    throw new Error('O consumo do veículo deve ser maior que zero.');
  }
  if (!Number.isFinite(precoLitroCentavos) || precoLitroCentavos <= 0) {
    throw new Error('O preço por litro deve ser maior que zero.');
  }

  const pedagios = Math.max(0, Math.round(Number(pedagiosCentavos) || 0));
  const alimentacao = Math.max(0, Math.round(Number(alimentacaoCentavos) || 0));
  const litrosEstimados = Number((distanciaKm / consumoKml).toFixed(2));
  const custoCombustivelCentavos = Math.round((distanciaKm / consumoKml) * precoLitroCentavos);
  const custoTotalCentavos = custoCombustivelCentavos + pedagios + alimentacao;
  const custoPorKmCentavos = Math.round(custoTotalCentavos / distanciaKm);

  const mensagem = `Custo previsto da viagem: ${formatarMoeda(custoTotalCentavos / 100)} (${formatarMoeda(custoPorKmCentavos / 100)}/km).`;

  return {
    litrosEstimados,
    custoCombustivelCentavos,
    pedagiosCentavos: pedagios,
    alimentacaoCentavos: alimentacao,
    custoTotalCentavos,
    custoPorKmCentavos,
    mensagem,
  };
}
