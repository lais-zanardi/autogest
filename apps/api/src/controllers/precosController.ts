import { Request, Response, NextFunction } from 'express';
import { RegionalPricesResponse, WeatherCacheRecord } from '@autogest/shared-types';
import {
  HistoricoPrecosRepository,
  PostgresHistoricoPrecosRepository,
  PostgresPrecosRepository,
  PrecosCombustivelRepository,
} from '../jobs/coletaPrecosAnpJob';
import {
  CacheClimaRepository,
  ClimaIntegrationService,
  PostgresCacheClimaRepository,
} from '../integracoes/clima';
import {
  PostgresPostosRepository,
  PostosRepository,
} from '../integracoes/postos';

export const AVISO_GRANULARIDADE_MUNICIPAL =
  'Preços médios municipais (ANP). Os valores podem variar entre postos da região.';

export class PrecosController {
  private static precosRepo: PrecosCombustivelRepository = new PostgresPrecosRepository();
  private static climaRepo: CacheClimaRepository = new PostgresCacheClimaRepository();
  private static postosRepo: PostosRepository = new PostgresPostosRepository();
  private static historicoRepo: HistoricoPrecosRepository = new PostgresHistoricoPrecosRepository();
  private static climaService: ClimaIntegrationService = new ClimaIntegrationService(
    undefined,
    PrecosController.climaRepo,
  );

  static setDependencies(deps: {
    precosRepo?: PrecosCombustivelRepository;
    climaRepo?: CacheClimaRepository;
    climaService?: ClimaIntegrationService;
    postosRepo?: PostosRepository;
    historicoRepo?: HistoricoPrecosRepository;
  }): void {
    if (deps.precosRepo) this.precosRepo = deps.precosRepo;
    if (deps.climaRepo) this.climaRepo = deps.climaRepo;
    if (deps.climaService) this.climaService = deps.climaService;
    if (deps.postosRepo) this.postosRepo = deps.postosRepo;
    if (deps.historicoRepo) this.historicoRepo = deps.historicoRepo;
  }

  /**
   * US17.5: GET /api/v1/precos?municipio=&combustivel=
   * Retorna preço médio local, histórico simples da semana, data da coleta,
   * aviso de granularidade (quando municipal) e clima local em cache de 24h.
   */
  static async getPrecos(req: Request, res: Response, next: NextFunction) {
    try {
      const municipio = String(req.query.municipio || '').trim();
      const combustivel = String(req.query.combustivel || '').trim();

      if (!municipio || !combustivel) {
        return res.status(400).json({
          error: 'Os parâmetros "municipio" e "combustivel" são obrigatórios.',
        });
      }

      const historicoDesc = await PrecosController.precosRepo.buscarPorMunicipioECombustivel(
        municipio,
        combustivel,
        7,
      );

      if (!historicoDesc.length) {
        return res.status(404).json({
          error: `Nenhum preço encontrado para ${combustivel} em ${municipio}.`,
        });
      }

      const maisRecente = historicoDesc[0];
      let clima: WeatherCacheRecord | null = null;
      try {
        clima = await PrecosController.climaService.obterClima(municipio, maisRecente.uf);
      } catch {
        // Clima é complementar e não deve impedir o retorno dos preços
        clima = null;
      }

      const historicoSemana = [...historicoDesc]
        .reverse()
        .map(item => ({
          data_coleta: item.data_coleta,
          preco_centavos: item.preco_centavos,
        }));

      const payload: RegionalPricesResponse = {
        municipio: maisRecente.municipio,
        uf: maisRecente.uf,
        combustivel: maisRecente.combustivel,
        preco_medio_centavos: maisRecente.preco_centavos,
        data_coleta: maisRecente.data_coleta,
        fonte: maisRecente.fonte,
        granularidade: maisRecente.granularidade,
        aviso_granularidade:
          maisRecente.granularidade === 'municipal' ? AVISO_GRANULARIDADE_MUNICIPAL : null,
        historico_semana: historicoSemana,
        clima,
      };

      return res.status(200).json(payload);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * US17.4: GET /api/v1/clima?municipio=&uf=
   */
  static async getClima(req: Request, res: Response, next: NextFunction) {
    try {
      const municipio = String(req.query.municipio || '').trim();
      const uf = req.query.uf ? String(req.query.uf).trim() : undefined;

      if (!municipio) {
        return res.status(400).json({ error: 'O parâmetro "municipio" é obrigatório.' });
      }

      const clima = await PrecosController.climaService.obterClima(municipio, uf);
      return res.status(200).json(clima);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * US17.1: Recurso de leitura de sync para `precos_combustivel`
   */
  static async listPrecosSync(req: Request, res: Response, next: NextFunction) {
    try {
      const atualizadoDesde = req.query.atualizado_desde
        ? String(req.query.atualizado_desde)
        : undefined;
      const items = await PrecosController.precosRepo.listarTodos(atualizadoDesde);
      return res.status(200).json({ items });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * US17.1: Recurso de leitura de sync para `cache_clima`
   */
  static async listClimaSync(req: Request, res: Response, next: NextFunction) {
    try {
      const atualizadoDesde = req.query.atualizado_desde
        ? String(req.query.atualizado_desde)
        : undefined;
      const items = await PrecosController.climaRepo.listarTodos(atualizadoDesde);
      return res.status(200).json({ items });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * US34.1: Recurso de leitura de sync para `postos` (somente leitura)
   */
  static async listPostosSync(req: Request, res: Response, next: NextFunction) {
    try {
      const atualizadoDesde = req.query.atualizado_desde
        ? String(req.query.atualizado_desde)
        : undefined;
      const items = await PrecosController.postosRepo.listarTodos(atualizadoDesde);
      return res.status(200).json({ items });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * US35.1: Recurso de leitura de sync para `historico_precos_locais`
   */
  static async listHistoricoPrecosSync(req: Request, res: Response, next: NextFunction) {
    try {
      const atualizadoDesde = req.query.atualizado_desde
        ? String(req.query.atualizado_desde)
        : undefined;
      const items = await PrecosController.historicoRepo.listarTodos(atualizadoDesde);
      return res.status(200).json({ items });
    } catch (error) {
      return next(error);
    }
  }
}
