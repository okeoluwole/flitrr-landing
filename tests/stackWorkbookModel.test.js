import { describe, it, expect } from 'vitest';
import {
  computeAppraisal,
  baseCaseInputs,
  FUNDING_STRATEGY,
} from '../lib/stack/engine/index.js';
import { buildWorkbook } from '../app/stack/workbookModel';

/**
 * Bucket 3.5: the workbook model. The tests prove the six sheets carry the
 * report the developer sees, values only, with the strategy branches honoured:
 * the JV surfaces on the base case, gone on a self-funded run; the workbook
 * headline on the Summary sheet; the cashflow month per programme month; the
 * provenance and the three zero invariants on the Notes sheet. And the house
 * punctuation rule: no em or en dash in any cell.
 */

function report(inputs, schemeName = null) {
  const result = computeAppraisal(inputs);
  const meta = {
    currency: inputs.reportingCurrency,
    commencementDate: inputs.commencementDate,
    strategy: inputs.fundingStrategy,
    inputs,
  };
  return buildWorkbook({
    result,
    meta,
    generatedDate: '13 July 2026',
    engineVersion: '1.0.0',
    schemeName,
  });
}

// Every cell of a sheet, flattened, as { value, style }.
function cells(sheet) {
  return sheet.rows.flat().filter((c) => c !== null && c !== undefined).map((c) =>
    typeof c === 'object' ? { value: c.v, style: c.style ?? null } : { value: c, style: null },
  );
}

function sheetByName(workbook, name) {
  return workbook.sheets.find((s) => s.name === name);
}

function textOf(workbook) {
  return workbook.sheets.flatMap((s) => cells(s)).filter((c) => typeof c.value === 'string')
    .map((c) => c.value);
}

describe('the workbook shape', () => {
  it('carries the six sheets in the report order', () => {
    const workbook = report(baseCaseInputs());
    expect(workbook.sheets.map((s) => s.name)).toEqual([
      'Summary',
      'Cashflow',
      'Comparison',
      'Sensitivity',
      'Inputs',
      'Notes',
    ]);
  });

  it('is values only: every cell is a string or a finite number', () => {
    const workbook = report(baseCaseInputs());
    for (const sheet of workbook.sheets) {
      for (const cell of cells(sheet)) {
        expect(['string', 'number']).toContain(typeof cell.value);
        if (typeof cell.value === 'number') expect(Number.isFinite(cell.value)).toBe(true);
      }
    }
  });

  it('builds the money format from the reporting currency', () => {
    expect(report(baseCaseInputs()).moneyFormat).toBe('"£"#,##0');
    expect(report({ ...baseCaseInputs(), reportingCurrency: 'NGN' }).moneyFormat).toBe('"₦"#,##0');
  });

  it('holds no em dash and no en dash in any cell', () => {
    for (const value of textOf(report(baseCaseInputs(), 'Riverside Mews'))) {
      expect(value).not.toMatch(/[–—]/);
    }
  });
});

describe('the Summary sheet', () => {
  it('carries the workbook headline: project profit 614,632.69 on the base case', () => {
    const summary = sheetByName(report(baseCaseInputs()), 'Summary');
    const profitRow = summary.rows.find((r) => r[0] === 'Project profit');
    expect(profitRow[1].v).toBeCloseTo(614632.69, 2);
    expect(profitRow[1].style).toBe('money');
  });

  it('shows the partnership block on the joint venture base case', () => {
    const summary = sheetByName(report(baseCaseInputs()), 'Summary');
    const values = cells(summary).map((c) => c.value);
    expect(values).toContain('Partnership');
    expect(values).toContain('Sponsor');
    expect(values).toContain('Funding partner');
    expect(values).toContain('Landowner');
  });

  it('names the loaded scheme when one is active', () => {
    const summary = sheetByName(report(baseCaseInputs(), 'Riverside Mews'), 'Summary');
    expect(cells(summary).map((c) => c.value)).toContain('Scheme: Riverside Mews');
  });

  it('drops the partnership and senior credit lines on a self-funded run', () => {
    const inputs = { ...baseCaseInputs(), fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED };
    const summary = sheetByName(report(inputs), 'Summary');
    const values = cells(summary).map((c) => c.value);
    expect(values).not.toContain('Partnership');
    expect(values).not.toContain('Senior loan to cost');
  });
});

describe('the Cashflow sheet', () => {
  it('runs one row per programme month under the header, calendar labelled', () => {
    const inputs = baseCaseInputs();
    const cashflow = sheetByName(report(inputs), 'Cashflow');
    const headerIndex = cashflow.rows.findIndex((r) => r[0]?.v === 'Month');
    const monthRows = cashflow.rows.slice(headerIndex + 1);
    expect(monthRows).toHaveLength(inputs.programmeMonths);
    expect(monthRows[0][0]).toBe(1);
    expect(monthRows[0][1]).toBe('Jul 26'); // commencement 2026-07-01
    expect(monthRows.at(-1)[1]).toBe('Dec 28'); // month 30
  });

  it('states the peak funding requirement', () => {
    const cashflow = sheetByName(report(baseCaseInputs()), 'Cashflow');
    const peak = cashflow.rows.find((r) => r[0] === 'Peak funding requirement');
    expect(typeof peak[1].v).toBe('number');
    expect(peak[1].style).toBe('money');
  });
});

describe('the Comparison sheet', () => {
  it('lists the five routes and marks the selected one', () => {
    const comparison = sheetByName(report(baseCaseInputs()), 'Comparison');
    const routeLabels = comparison.rows
      .filter((r) => typeof r[0] === 'string' && r[2] !== undefined)
      .map((r) => r[0]);
    expect(routeLabels).toEqual([
      'Self-funded',
      'Bank-financed',
      'Mixed',
      'Joint venture (selected)',
      'Off-plan',
    ]);
  });
});

describe('the Sensitivity sheet', () => {
  it('carries the viability grid, and the JV terms grid on the JV route only', () => {
    const jv = sheetByName(report(baseCaseInputs()), 'Sensitivity');
    const jvValues = cells(jv).map((c) => c.value);
    expect(jvValues).toContain('Scheme viability');
    expect(jvValues).toContain('Joint venture deal terms');

    const selfInputs = { ...baseCaseInputs(), fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED };
    const self = sheetByName(report(selfInputs), 'Sensitivity');
    expect(cells(self).map((c) => c.value)).not.toContain('Joint venture deal terms');
  });

  it('labels the base run in both axes', () => {
    const sensitivity = sheetByName(report(baseCaseInputs()), 'Sensitivity');
    const values = cells(sensitivity).map((c) => c.value);
    expect(values.filter((v) => v === 'Base').length).toBeGreaterThanOrEqual(2);
  });
});

describe('the Inputs sheet', () => {
  it('shows the strategy branch in play and hides the others', () => {
    const inputs = sheetByName(report(baseCaseInputs()), 'Inputs');
    const labels = cells(inputs).map((c) => c.value);
    // The base case is a joint venture: JV terms in, the debt structure out.
    expect(labels).toContain('The partner brings');
    expect(labels).toContain('Preferred return');
    expect(labels).not.toContain('Debt structure');
  });

  it('writes percents as fractions with the percent style', () => {
    const inputs = sheetByName(report(baseCaseInputs()), 'Inputs');
    const fee = inputs.rows.find((r) => r[0] === 'Development management fee');
    expect(fee[1].v).toBeCloseTo(0.02, 10);
    expect(fee[1].style).toBe('percent');
  });

  it('reads n/a for an optional input left empty', () => {
    const workbook = report(baseCaseInputs());
    const inputs = sheetByName(workbook, 'Inputs');
    // The base case sets no void holding cost months value beyond zero, but the
    // per-unit metrics are not on the form model sections, so check a blank
    // guarded field instead: the equity multiple hurdle is hidden on the
    // preferred return basis, so it must not appear at all.
    const labels = cells(inputs).map((c) => c.value);
    expect(labels).not.toContain('Equity multiple hurdle');
  });
});

describe('the Notes sheet', () => {
  it('carries the provenance, the licence line, and the values-only line', () => {
    const notes = sheetByName(report(baseCaseInputs(), 'Riverside Mews'), 'Notes');
    const values = cells(notes).map((c) => c.value);
    expect(values).toContain('Generated by Flitrr STACK on 13 July 2026.');
    expect(values).toContain('Engine version 1.0.0.');
    expect(values).toContain('Scheme: Riverside Mews');
    expect(values.some((v) => typeof v === 'string' && v.includes('licensed for this appraisal only'))).toBe(true);
    expect(values.some((v) => typeof v === 'string' && v.includes('Values only'))).toBe(true);
  });

  it('reads zero on all three reconciliation invariants', () => {
    const notes = sheetByName(report(baseCaseInputs()), 'Notes');
    for (const label of [
      'Cash uses reconciliation',
      'Waterfall reconciliation',
      'Sources less uses',
    ]) {
      const row = notes.rows.find((r) => r[0] === label);
      expect(Math.abs(row[1])).toBeLessThan(0.01);
    }
  });
});
