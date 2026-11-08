import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  formatCurrency,
  formatNumber,
  formatKm,
  formatMonth,
  formatDecimal,
} from '../utils/formatters';

describe('UX-04, UX-05 & UX-19 — Formatadores Unificados pt-BR', () => {
  test('formatKm: 49380 -> "49.380 km"', () => {
    assert.strictEqual(formatKm(49380), '49.380 km');
    assert.strictEqual(formatKm(0), '0 km');
    assert.strictEqual(formatKm(null), '0 km');
  });

  test('formatDecimal: 255 com 1 casa -> "255,0"', () => {
    assert.strictEqual(formatDecimal(255, 1), '255,0');
  });

  test('formatNumber: 1093 -> "1.093"', () => {
    assert.strictEqual(formatNumber(1093), '1.093');
  });

  test('formatCurrency: 820 -> "R$ 820,00"', () => {
    const formatted = formatCurrency(820).replace(/\u00a0/g, ' ');
    assert.strictEqual(formatted, 'R$ 820,00');
  });

  test('formatMonth: "2026-11" -> "nov/2026"', () => {
    assert.strictEqual(formatMonth('2026-11'), 'nov/2026');
    assert.strictEqual(formatMonth('2026-05-18'), 'mai/2026');
  });
});
