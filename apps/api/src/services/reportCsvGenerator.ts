/**
 * US19.3: Gerador de CSV para relatórios em pt-BR (Excel Windows)
 * - Inicia com UTF-8 BOM (\uFEFF)
 * - Separador ponto-e-vírgula (;)
 * - Vírgula como separador decimal
 * - Datas formatadas em dd/MM/aaaa
 * - Valores a partir de centavos inteiros
 */

export interface ExpenseReportItem {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  valorCentavos: number;
}

export interface ExpenseCategoryTotal {
  categoria: string;
  totalCentavos: number;
  quantidade: number;
}

export interface ExpensesReportPayload {
  vehicle: { id: string; name: string; plate: string };
  period: { de: string; ate: string };
  totalsByCategory: ExpenseCategoryTotal[];
  totalGeralCentavos: number;
  items: ExpenseReportItem[];
}

export interface MaintenanceReportItem {
  id: string;
  data: string;
  km: number;
  tipo: string;
  tipoServico: string;
  descricao: string;
  oficina?: string | null;
  valorCentavos: number;
}

export interface MaintenancesReportPayload {
  vehicle: { id: string; name: string; plate: string };
  period: { de: string; ate: string };
  totalGeralCentavos: number;
  items: MaintenanceReportItem[];
}

/**
 * Converte centavos inteiros em formato monetário pt-BR (ex: 25000 -> "250,00")
 */
export function formatCentavosCsv(centavos: number): string {
  const num = (centavos || 0) / 100;
  return num.toFixed(2).replace('.', ',');
}

/**
 * Converte data ISO (YYYY-MM-DD...) em dd/MM/aaaa
 */
export function formatDateCsv(isoDate: string): string {
  if (!isoDate) return '';
  const dateOnly = isoDate.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return isoDate;
}

function escapeCsvField(text: string | null | undefined): string {
  if (!text) return '';
  const str = String(text);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateExpensesCsv(data: ExpensesReportPayload): string {
  const lines: string[] = [];

  // BOM para o Excel abrir UTF-8 sem corromper caracteres
  const BOM = '\uFEFF';

  // Cabeçalho institucional do relatório
  lines.push('AUTOGEST — EXTRATO DE GASTOS');
  lines.push(`Veículo;${escapeCsvField(`${data.vehicle.name} (${data.vehicle.plate})`)}`);
  lines.push(`Período;${formatDateCsv(data.period.de)} até ${formatDateCsv(data.period.ate)}`);
  lines.push(`Gerado em;${formatDateCsv(new Date().toISOString())}`);
  lines.push('');

  // Tabela analítica de lançamentos
  lines.push('LANÇAMENTOS INDIVIDUAIS');
  lines.push('Data;Categoria;Descrição;Valor (R$)');

  for (const item of data.items) {
    const row = [
      formatDateCsv(item.data),
      escapeCsvField(item.categoria),
      escapeCsvField(item.descricao),
      formatCentavosCsv(item.valorCentavos),
    ];
    lines.push(row.join(';'));
  }

  lines.push('');
  lines.push('TOTAIS POR CATEGORIA');
  lines.push('Categoria;Valor (R$);Quantidade');

  for (const cat of data.totalsByCategory) {
    lines.push(
      `${escapeCsvField(cat.categoria)};${formatCentavosCsv(cat.totalCentavos)};${cat.quantidade}`
    );
  }

  lines.push('');
  lines.push(`TOTAL GERAL;${formatCentavosCsv(data.totalGeralCentavos)}`);

  return BOM + lines.join('\r\n');
}

export function generateMaintenancesCsv(data: MaintenancesReportPayload): string {
  const lines: string[] = [];
  const BOM = '\uFEFF';

  lines.push('AUTOGEST — HISTÓRICO DE MANUTENÇÕES');
  lines.push(`Veículo;${escapeCsvField(`${data.vehicle.name} (${data.vehicle.plate})`)}`);
  lines.push(`Período;${formatDateCsv(data.period.de)} até ${formatDateCsv(data.period.ate)}`);
  lines.push(`Gerado em;${formatDateCsv(new Date().toISOString())}`);
  lines.push('');

  lines.push('HISTÓRICO DE SERVIÇOS');
  lines.push('Data;Km;Tipo;Tipo de Serviço;Descrição;Oficina;Valor (R$)');

  for (const item of data.items) {
    const tipoFormatado =
      item.tipo === 'preventiva'
        ? 'Preventiva'
        : item.tipo === 'corretiva'
          ? 'Corretiva'
          : item.tipo;

    const row = [
      formatDateCsv(item.data),
      item.km != null ? String(item.km) : '',
      escapeCsvField(tipoFormatado),
      escapeCsvField(item.tipoServico),
      escapeCsvField(item.descricao),
      escapeCsvField(item.oficina || 'Não informada'),
      formatCentavosCsv(item.valorCentavos),
    ];
    lines.push(row.join(';'));
  }

  lines.push('');
  lines.push(`TOTAL GERAL;${formatCentavosCsv(data.totalGeralCentavos)}`);

  return BOM + lines.join('\r\n');
}
