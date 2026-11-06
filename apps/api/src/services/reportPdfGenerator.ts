import PDFDocument from 'pdfkit';
import {
  ExpensesReportPayload,
  MaintenancesReportPayload,
  formatCentavosCsv,
  formatDateCsv,
} from './reportCsvGenerator';

/**
 * US19.4: Gerador de PDF em stream usando pdfkit
 * Cabeçalho institucional (veículo, período, data de geração),
 * tabelas analíticas com quebra de página automática e totais por categoria.
 */

export function generateExpensesPdfStream(data: ExpensesReportPayload): NodeJS.ReadableStream {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Extrato de Gastos — ${data.vehicle.name}`,
      Author: 'AutoGest',
    },
  });

  // Cabeçalho
  doc.fontSize(20).text('AutoGest — Gestão Veicular Inteligente', { align: 'left' });
  doc.fontSize(14).text('Extrato Consolidado de Gastos', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(10);
  doc.text(`Veículo: ${data.vehicle.name} (${data.vehicle.plate})`);
  doc.text(`Período: ${formatDateCsv(data.period.de)} até ${formatDateCsv(data.period.ate)}`);
  doc.text(`Data de Emissão: ${formatDateCsv(new Date().toISOString())}`);
  doc.moveDown(1);

  // Totais por Categoria
  doc.fontSize(12).text('1. Resumo por Categoria', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);

  for (const cat of data.totalsByCategory) {
    doc.text(
      `• ${cat.categoria}: R$ ${formatCentavosCsv(cat.totalCentavos)} (${cat.quantidade} lançamento(s))`
    );
  }
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Total Geral: R$ ${formatCentavosCsv(data.totalGeralCentavos)}`);
  doc.moveDown(1.5);

  // Lançamentos Analíticos
  doc.fontSize(12).text('2. Lançamentos Individuais', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(9);

  // Cabeçalho da Tabela
  const startX = 40;
  let currentY = doc.y;

  doc.text('Data', startX, currentY);
  doc.text('Categoria', startX + 70, currentY);
  doc.text('Descrição', startX + 170, currentY);
  doc.text('Valor (R$)', startX + 430, currentY, { align: 'right' });
  doc.moveDown(0.3);

  doc.moveTo(startX, doc.y).lineTo(startX + 515, doc.y).stroke();
  doc.moveDown(0.4);

  for (const item of data.items) {
    // Quebra de página se aproximar do rodapé
    if (doc.y > 750) {
      doc.addPage();
      currentY = doc.y;
      doc.text('Data', startX, currentY);
      doc.text('Categoria', startX + 70, currentY);
      doc.text('Descrição', startX + 170, currentY);
      doc.text('Valor (R$)', startX + 430, currentY, { align: 'right' });
      doc.moveDown(0.3);
      doc.moveTo(startX, doc.y).lineTo(startX + 515, doc.y).stroke();
      doc.moveDown(0.4);
    }

    currentY = doc.y;
    doc.text(formatDateCsv(item.data), startX, currentY);
    doc.text(item.categoria, startX + 70, currentY);
    doc.text(item.descricao.substring(0, 48), startX + 170, currentY);
    doc.text(`R$ ${formatCentavosCsv(item.valorCentavos)}`, startX + 430, currentY, {
      align: 'right',
    });
    doc.moveDown(0.3);
  }

  doc.end();
  return doc;
}

export function generateMaintenancesPdfStream(data: MaintenancesReportPayload): NodeJS.ReadableStream {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Histórico de Manutenções — ${data.vehicle.name}`,
      Author: 'AutoGest',
    },
  });

  // Cabeçalho
  doc.fontSize(20).text('AutoGest — Gestão Veicular Inteligente', { align: 'left' });
  doc.fontSize(14).text('Histórico de Manutenções e Serviços', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(10);
  doc.text(`Veículo: ${data.vehicle.name} (${data.vehicle.plate})`);
  doc.text(`Período: ${formatDateCsv(data.period.de)} até ${formatDateCsv(data.period.ate)}`);
  doc.text(`Data de Emissão: ${formatDateCsv(new Date().toISOString())}`);
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Investimento Total em Manutenções: R$ ${formatCentavosCsv(data.totalGeralCentavos)}`);
  doc.moveDown(1.5);

  // Tabela Analítica
  doc.fontSize(12).text('Serviços Realizados', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(9);

  const startX = 40;
  let currentY = doc.y;

  doc.text('Data', startX, currentY);
  doc.text('Km', startX + 65, currentY);
  doc.text('Tipo', startX + 115, currentY);
  doc.text('Serviço / Descrição', startX + 185, currentY);
  doc.text('Oficina', startX + 370, currentY);
  doc.text('Valor', startX + 460, currentY, { align: 'right' });
  doc.moveDown(0.3);

  doc.moveTo(startX, doc.y).lineTo(startX + 515, doc.y).stroke();
  doc.moveDown(0.4);

  for (const item of data.items) {
    if (doc.y > 750) {
      doc.addPage();
      currentY = doc.y;
      doc.text('Data', startX, currentY);
      doc.text('Km', startX + 65, currentY);
      doc.text('Tipo', startX + 115, currentY);
      doc.text('Serviço / Descrição', startX + 185, currentY);
      doc.text('Oficina', startX + 370, currentY);
      doc.text('Valor', startX + 460, currentY, { align: 'right' });
      doc.moveDown(0.3);
      doc.moveTo(startX, doc.y).lineTo(startX + 515, doc.y).stroke();
      doc.moveDown(0.4);
    }

    currentY = doc.y;
    doc.text(formatDateCsv(item.data), startX, currentY);
    doc.text(item.km ? `${item.km} km` : '—', startX + 65, currentY);
    doc.text(item.tipo === 'preventiva' ? 'Prev.' : 'Corr.', startX + 115, currentY);
    doc.text(`${item.tipoServico}: ${item.descricao}`.substring(0, 36), startX + 185, currentY);
    doc.text((item.oficina || '—').substring(0, 16), startX + 370, currentY);
    doc.text(`R$ ${formatCentavosCsv(item.valorCentavos)}`, startX + 460, currentY, {
      align: 'right',
    });
    doc.moveDown(0.3);
  }

  doc.end();
  return doc;
}
