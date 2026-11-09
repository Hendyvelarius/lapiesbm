import XLSX from 'xlsx-js-style';
import { COLORS } from './excelExport';

/**
 * HPP Actual vs Standard period report.
 *
 * Builds a styled workbook with a Summary sheet and one batch-level sheet per product
 * group. Cells hold real numbers and dates, so Excel can sort and filter them correctly.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatPeriodLabel = (periode) => {
  const month = parseInt(periode.substring(4, 6), 10);
  return `${MONTH_NAMES[month - 1]} ${periode.substring(0, 4)}`;
};

// Every YYYYMM from `from` to `to`, inclusive
export const listPeriodsBetween = (from, to) => {
  const result = [];
  let year = parseInt(from.substring(0, 4), 10);
  let month = parseInt(from.substring(4, 6), 10);
  const toPeriod = (y, m) => `${y}${String(m).padStart(2, '0')}`;
  while (toPeriod(year, month) <= to) {
    result.push(toPeriod(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
};

const describeRange = (from, to) => (
  from === to ? formatPeriodLabel(from) : `${formatPeriodLabel(from)} - ${formatPeriodLabel(to)}`
);

/**
 * Turn the period picker selection into an inclusive YYYYMM range and a display label.
 * @param {Object} selection
 * @param {'month'|'year'|'ytd'|'custom'} selection.mode
 * @param {string} [selection.period] - YYYYMM, for 'month'
 * @param {string} [selection.year] - YYYY, for 'year' and 'ytd'
 * @param {string} [selection.through] - YYYYMM last month, for 'ytd'
 * @param {string} [selection.from] - YYYYMM, for 'custom'
 * @param {string} [selection.to] - YYYYMM, for 'custom'
 */
export const resolvePeriodSelection = ({ mode, period, year, through, from, to }) => {
  switch (mode) {
    case 'month':
      return { from: period, to: period, label: `Single Month: ${formatPeriodLabel(period)}` };
    case 'year':
      return { from: `${year}01`, to: `${year}12`, label: `Full Year ${year}` };
    case 'ytd':
      return { from: `${year}01`, to: through, label: `Year to Date ${year}: ${describeRange(`${year}01`, through)}` };
    default:
      return { from, to, label: `Custom Range: ${describeRange(from, to)}` };
  }
};

const FORMAT = {
  integer: '#,##0',
  decimal: '#,##0.00',
  percent: '0.00%',
  signedPercent: '+0.00%;-0.00%;0.00%',
  signedInteger: '+#,##0;-#,##0;0',
  date: 'dd-mmm-yyyy',
  month: 'mmm yyyy',
};

const STATUS = {
  better: 'Better',
  worse: 'Worse',
  noStandard: 'No Standard',
  incomplete: 'Incomplete Actual',
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const fraction = (percent) => {
  const number = toNumber(percent);
  return number === null ? null : number / 100;
};

// A batch has no LOB when its product had no group at calculation time; the name still marks generics
export const isEthicalGroup = ({ LOB, Product_Name }) => (
  LOB ? ['ETHICAL', 'ETH', 'OTC'].includes(LOB) : !/generik/i.test(Product_Name || '')
);

const manhours = (batch) => (toNumber(batch.MH_Proses_Actual ?? batch.MH_Proses_Std) || 0)
  + (toNumber(batch.MH_Kemas_Actual ?? batch.MH_Kemas_Std) || 0);

/**
 * The parameters compared in the report.
 *  standard/actual: how to read the value from a standard and a batch
 *  better:          which direction counts as better than standard
 *  additive:        whether summing across batches is meaningful
 *  estimated:       true when the batch has no recorded actual, so standard was used instead
 *  overall:         a whole-batch result, only meaningful when the batch has complete actuals
 *  single:          one column instead of a Standard/Actual pair
 */
const METRICS = {
  output: {
    label: 'Output', format: FORMAT.integer, better: 'higher', additive: true, width: 12,
    standard: (s) => s.expectedOutput,
    actual: (b) => b.Output_Actual,
  },
  rendemen: {
    label: 'Rendemen', format: FORMAT.percent, better: 'higher', width: 11,
    standard: (s) => s.rendemen / 100,
    actual: (b) => fraction(b.Rendemen_Actual),
  },
  totalBB: {
    label: 'Total BB', format: FORMAT.integer, better: 'lower', additive: true, width: 15,
    standard: (s) => s.totalBB,
    actual: (b) => b.Total_Cost_BB,
  },
  totalBK: {
    label: 'Total BK', format: FORMAT.integer, better: 'lower', additive: true, width: 15,
    standard: (s) => s.totalBK,
    actual: (b) => b.Total_Cost_BK,
  },
  mhProses: {
    label: 'MH Proses', format: FORMAT.decimal, better: 'lower', additive: true, width: 11,
    standard: (s) => s.mhProses,
    actual: (b) => b.MH_Proses_Actual ?? b.MH_Proses_Std,
    estimated: (b) => b.MH_Proses_Actual === null || b.MH_Proses_Actual === undefined,
  },
  mhKemas: {
    label: 'MH Kemas', format: FORMAT.decimal, better: 'lower', additive: true, width: 11,
    standard: (s) => s.mhKemas,
    actual: (b) => b.MH_Kemas_Actual ?? b.MH_Kemas_Std,
    estimated: (b) => b.MH_Kemas_Actual === null || b.MH_Kemas_Actual === undefined,
  },
  mhTimbangBB: {
    label: 'MH Timbang BB', format: FORMAT.decimal, better: 'lower', additive: true, width: 11,
    standard: (s) => s.mhTimbangBB,
    actual: (b) => b.MH_Timbang_BB,
  },
  mhTimbangBK: {
    label: 'MH Timbang BK', format: FORMAT.decimal, better: 'lower', additive: true, width: 11,
    standard: (s) => s.mhTimbangBK,
    actual: (b) => b.MH_Timbang_BK,
  },
  mhAnalisa: {
    label: 'MH Analisa', format: FORMAT.decimal, better: 'lower', additive: true, width: 11,
    standard: (s) => s.mhAnalisa,
    actual: (b) => b.MH_Analisa_Std,
  },
  mhMesin: {
    label: 'MH Mesin', format: FORMAT.decimal, better: 'lower', additive: true, width: 11,
    standard: (s) => s.mhMesin,
    actual: (b) => b.MH_Mesin_Std,
  },
  biayaProses: {
    label: 'Biaya Proses', format: FORMAT.integer, better: 'lower', additive: true, width: 14,
    standard: (s) => s.mhProses * s.rateProses,
    actual: (b) => b.Biaya_Proses,
    estimated: (b) => b.MH_Proses_Actual === null || b.MH_Proses_Actual === undefined,
  },
  biayaKemas: {
    label: 'Biaya Kemas', format: FORMAT.integer, better: 'lower', additive: true, width: 14,
    standard: (s) => s.mhKemas * s.rateKemas,
    actual: (b) => b.Biaya_Kemas,
    estimated: (b) => b.MH_Kemas_Actual === null || b.MH_Kemas_Actual === undefined,
  },
  biayaTimbang: {
    label: 'Biaya Timbang', format: FORMAT.integer, better: 'lower', additive: true, width: 14,
    standard: (s) => s.mhTimbangBB * s.rateProses + s.mhTimbangBK * s.rateKemas,
    actual: (b) => (toNumber(b.Biaya_Timbang_BB) || 0) + (toNumber(b.Biaya_Timbang_BK) || 0),
  },
  biayaAnalisa: {
    label: 'Biaya Analisa', format: FORMAT.integer, better: 'lower', additive: true, width: 14,
    standard: (s) => s.mhAnalisa * s.rateAnalisa,
    actual: (b) => (toNumber(b.MH_Analisa_Std) || 0) * (toNumber(b.Biaya_Analisa) || 0),
  },
  biayaMesin: {
    label: 'Biaya Mesin', format: FORMAT.integer, better: 'lower', additive: true, width: 14,
    standard: (s) => s.mhMesin * s.ratePLN,
    actual: (b) => b.Cost_Utility,
  },
  biayaReagen: {
    label: 'Biaya Reagen', format: FORMAT.integer, better: 'lower', additive: true, width: 14,
    standard: (s) => s.biayaReagen,
    actual: (b) => b.Biaya_Reagen,
  },
  expiry: {
    label: 'Expiry Cost', format: FORMAT.integer, better: 'lower', additive: true, width: 14,
    standard: (s) => s.expiry,
    actual: (b) => b.Beban_Sisa_Bahan_Exp,
  },
  fohDepresiasi: {
    label: 'FOH + Depresiasi', format: FORMAT.integer, single: true, width: 15,
    standard: () => null,
    actual: (b) => (b.LOB === 'ETHICAL'
      ? null
      : manhours(b) * ((toNumber(b.Factory_Overhead) || 0) + (toNumber(b.Depresiasi) || 0))),
  },
  hppBatch: {
    label: 'HPP Batch', format: FORMAT.integer, better: 'lower', additive: true, overall: true, width: 15,
    standard: (s) => s.hppPerUnit * s.expectedOutput,
    actual: (b) => b.Total_HPP_Batch,
  },
  hppUnit: {
    label: 'HPP / Unit', format: FORMAT.integer, better: 'lower', overall: true, width: 12,
    standard: (s) => s.hppPerUnit,
    actual: (b) => b.HPP_Per_Unit,
  },
  hna: {
    label: 'HNA', format: FORMAT.integer, single: true, width: 12,
    standard: () => null,
    actual: (b) => b.HNA,
  },
  hppHna: {
    label: 'HPP / HNA', format: FORMAT.percent, better: 'lower', overall: true, width: 11,
    standard: (s, b) => (toNumber(b.HNA) > 0 ? s.hppPerUnit / b.HNA : null),
    actual: (b) => (toNumber(b.HNA) > 0 ? fraction(b.HPP_Ratio) : null),
  },
};

const ETHICAL_METRICS = [
  'output', 'rendemen', 'totalBB', 'totalBK', 'mhProses', 'mhKemas', 'biayaProses', 'biayaKemas',
  'expiry', 'fohDepresiasi', 'hppBatch', 'hppUnit', 'hna', 'hppHna',
];

const GENERIC_METRICS = [
  'output', 'rendemen', 'totalBB', 'totalBK', 'mhProses', 'mhKemas', 'mhTimbangBB', 'mhTimbangBK',
  'mhAnalisa', 'mhMesin', 'biayaProses', 'biayaKemas', 'biayaTimbang', 'biayaAnalisa', 'biayaMesin',
  'biayaReagen', 'expiry', 'fohDepresiasi', 'hppBatch', 'hppUnit', 'hna', 'hppHna',
];

// Summary order: every additive parameter across both groups
const SUMMARY_METRICS = GENERIC_METRICS.filter((id) => METRICS[id].additive);

// A missing or zero value means there is nothing to judge, not that the batch did better
const compareToStandard = (actual, standard, better) => {
  if (!(actual > 0) || !(standard > 0)) return 'neutral';
  const isBetter = better === 'higher' ? actual >= standard : actual <= standard;
  return isBetter ? 'better' : 'worse';
};

const buildRow = (batch, standards) => {
  const found = standards[batch.Periode.substring(0, 4)]?.[batch.Product_ID];
  // Some products carry a placeholder standard (batch size 1, HPP 0): treat those as no standard
  const standard = found?.hppPerUnit > 0 ? found : null;
  const actualPerUnit = toNumber(batch.HPP_Per_Unit);
  const output = toNumber(batch.Output_Actual);
  // A batch missing a cost the standard expects would otherwise look far better than standard.
  // A null actual manhour with a standard on the batch is fine: the standard is used instead.
  // No LOB also means no manhour rates were loaded, so the batch only carries its material cost.
  const missingCost = standard && (
    !batch.LOB
    || (standard.totalBB > 0 && !(toNumber(batch.Total_Cost_BB) > 0))
    || (standard.totalBK > 0 && !(toNumber(batch.Total_Cost_BK) > 0))
    || (standard.mhProses > 0 && !(toNumber(batch.MH_Proses_Actual ?? batch.MH_Proses_Std) > 0))
    || (standard.mhKemas > 0 && !(toNumber(batch.MH_Kemas_Actual ?? batch.MH_Kemas_Std) > 0))
  );
  const compared = Boolean(standard) && actualPerUnit > 0 && output > 0 && !missingCost;
  const variance = compared ? actualPerUnit / standard.hppPerUnit - 1 : null;

  let status = STATUS.incomplete;
  if (!standard) status = STATUS.noStandard;
  else if (compared) status = variance <= 0 ? STATUS.better : STATUS.worse;

  const metrics = {};
  Object.entries(METRICS).forEach(([id, metric]) => {
    const standardValue = standard ? toNumber(metric.standard(standard, batch)) : null;
    const actualValue = toNumber(metric.actual(batch));
    const estimated = Boolean(metric.estimated?.(batch));
    metrics[id] = {
      standard: standardValue,
      actual: actualValue,
      estimated,
      state: estimated || !metric.better || (metric.overall && !compared)
        ? 'neutral'
        : compareToStandard(actualValue, standardValue, metric.better),
    };
  });

  return {
    batch,
    metrics,
    compared,
    variance,
    status,
    standardAtVolume: compared ? standard.hppPerUnit * output : null,
    actualCost: compared ? toNumber(batch.Total_HPP_Batch) : null,
    outputCompared: compared ? output : null,
  };
};

const sumOf = (rows, read) => rows.reduce((total, row) => total + (read(row) || 0), 0);

const summarize = (rows) => {
  const compared = rows.filter((row) => row.compared);
  const standardAtVolume = sumOf(compared, (row) => row.standardAtVolume);
  const actualCost = sumOf(compared, (row) => row.actualCost);
  const output = sumOf(compared, (row) => row.outputCompared);

  const metrics = {};
  SUMMARY_METRICS.forEach((id) => {
    // Only batches holding both values, so the two totals cover the same population
    const pairs = compared.filter((row) => row.metrics[id].standard > 0 && row.metrics[id].actual > 0);
    metrics[id] = pairs.length === 0 ? null : {
      standard: sumOf(pairs, (row) => row.metrics[id].standard),
      actual: sumOf(pairs, (row) => row.metrics[id].actual),
    };
  });

  return {
    batches: rows.length,
    compared: compared.length,
    better: compared.filter((row) => row.status === STATUS.better).length,
    worse: compared.filter((row) => row.status === STATUS.worse).length,
    uncompared: rows.length - compared.length,
    standardAtVolume,
    actualCost,
    metrics,
    perUnit: output > 0 ? { standard: standardAtVolume / output, actual: actualCost / output } : null,
  };
};

const byProductThenPeriod = (a, b) => (
  (a.batch.Product_Name || '').localeCompare(b.batch.Product_Name || '')
  || a.batch.Periode.localeCompare(b.batch.Periode)
  || (a.batch.BatchNo || '').localeCompare(b.batch.BatchNo || '')
);

// ---------------------------------------------------------------------------
// Cell styles
// ---------------------------------------------------------------------------

const edge = { style: 'thin', color: { rgb: COLORS.borderColor } };
const BORDER = { top: edge, bottom: edge, left: edge, right: edge };

const style = ({ fill, color = COLORS.black, bold = false, italic = false, size = 10, align = 'left', wrap = false, border = true } = {}) => ({
  font: { name: 'Calibri', sz: size, bold, italic, color: { rgb: color } },
  ...(fill ? { fill: { patternType: 'solid', fgColor: { rgb: fill } } } : {}),
  alignment: { horizontal: align, vertical: 'center', wrapText: wrap },
  ...(border ? { border: BORDER } : {}),
});

const NAVY = '1F3A5F';
const MID_GREY = '6C757D';

const STYLES = {
  title: style({ fill: NAVY, color: COLORS.white, bold: true, size: 16, border: false }),
  subtitle: style({ fill: NAVY, color: 'D6E0EC', size: 10, border: false }),
  sheetTitle: style({ color: NAVY, bold: true, size: 14, border: false }),
  sheetSubtitle: style({ color: MID_GREY, size: 10, border: false }),
  section: style({ fill: 'DCE6F1', color: NAVY, bold: true, size: 11, border: false }),
  infoLabel: style({ fill: COLORS.altRowBg, bold: true }),
  infoValue: style({}),
  header: style({ fill: COLORS.headerBg, color: COLORS.white, bold: true, align: 'center', wrap: true }),
  headerStandard: style({ fill: MID_GREY, color: COLORS.white, bold: true, align: 'center', wrap: true }),
  text: style({}),
  textBold: style({ bold: true }),
  center: style({ align: 'center' }),
  number: style({ align: 'right' }),
  numberBold: style({ align: 'right', bold: true }),
  standard: style({ fill: COLORS.grayBg, color: COLORS.grayFont, align: 'right' }),
  better: style({ fill: COLORS.greenBg, color: COLORS.greenFont, align: 'right' }),
  worse: style({ fill: COLORS.redBg, color: COLORS.redFont, align: 'right' }),
  neutral: style({ align: 'right' }),
  estimated: style({ color: MID_GREY, italic: true, align: 'right' }),
  statusBetter: style({ fill: COLORS.greenBg, color: COLORS.greenFont, align: 'center', bold: true }),
  statusWorse: style({ fill: COLORS.redBg, color: COLORS.redFont, align: 'center', bold: true }),
  statusNone: style({ fill: COLORS.yellowBg, color: COLORS.yellowFont, align: 'center' }),
  total: style({ fill: 'FFF8E1', bold: true, align: 'right' }),
  totalLabel: style({ fill: 'FFF8E1', bold: true }),
  note: style({ color: '495057', wrap: true, border: false }),
  legendBetter: style({ fill: COLORS.greenBg, color: COLORS.greenFont, align: 'center' }),
  legendWorse: style({ fill: COLORS.redBg, color: COLORS.redFont, align: 'center' }),
  legendStandard: style({ fill: COLORS.grayBg, color: COLORS.grayFont, align: 'center' }),
  legendNeutral: style({ align: 'center' }),
  legendEstimated: style({ color: MID_GREY, italic: true, align: 'center' }),
};

const textCell = (value, cellStyle = STYLES.text) => ({ t: 's', v: value ?? '', s: cellStyle });

const numberCell = (value, format, cellStyle = STYLES.number) => (
  value === null || value === undefined
    ? { t: 's', v: '-', s: cellStyle }
    : { t: 'n', v: value, z: format, s: cellStyle }
);

// Sortable columns need truly empty cells: Excel always sorts those last, whereas a "-" would
// jump to the top of a descending sort. The library drops styled empty cells, so write a
// placeholder and let applySheetViews turn it into an empty cell that keeps its style.
const EMPTY_CELL = '__EMPTY_CELL__';

const sortableNumberCell = (value, format, cellStyle = STYLES.number) => (
  value === null || value === undefined
    ? { t: 's', v: EMPTY_CELL, s: cellStyle }
    : { t: 'n', v: value, z: format, s: cellStyle }
);

const toExcelDate = (year, monthIndex, day) => Date.UTC(year, monthIndex, day) / 86400000 + 25569;

const batchDateCell = (value) => {
  const time = value ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return textCell(EMPTY_CELL, STYLES.center);
  return { t: 'n', v: Math.floor(time / 86400000) + 25569, z: FORMAT.date, s: STYLES.center };
};

const periodCell = (periode) => ({
  t: 'n',
  v: toExcelDate(parseInt(periode.substring(0, 4), 10), parseInt(periode.substring(4, 6), 10) - 1, 1),
  z: FORMAT.month,
  s: STYLES.center,
});

const newSheet = () => {
  const sheet = { '!merges': [], '!rows': [] };
  let maxRow = 0;
  let maxCol = 0;
  return {
    sheet,
    put(row, col, cell) {
      sheet[XLSX.utils.encode_cell({ r: row, c: col })] = cell;
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);
    },
    merge(startRow, startCol, endRow, endCol) {
      sheet['!merges'].push({ s: { r: startRow, c: startCol }, e: { r: endRow, c: endCol } });
    },
    height(row, points) {
      sheet['!rows'][row] = { hpt: points };
    },
    finish() {
      sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
      return sheet;
    },
  };
};

// ---------------------------------------------------------------------------
// Batch sheets
// ---------------------------------------------------------------------------

const ID_COLUMNS = [
  { header: 'Product ID', width: 11, cell: (row) => textCell(row.batch.Product_ID) },
  { header: 'Product Name', width: 40, cell: (row) => textCell(row.batch.Product_Name) },
  { header: 'Batch No', width: 12, cell: (row) => textCell(row.batch.BatchNo) },
  { header: 'Batch Date', width: 13, cell: (row) => batchDateCell(row.batch.BatchDate) },
  { header: 'Period', width: 11, cell: (row) => periodCell(row.batch.Periode) },
  { header: 'LOB', width: 10, cell: (row) => textCell(row.batch.LOB, STYLES.center) },
  { header: 'Category', width: 24, cell: (row) => textCell(row.batch.Group_PNCategory_Name) },
];

const FROZEN_COLUMNS = 3;
const BATCH_TOTAL_ROW = 3;
const BATCH_GROUP_ROW = 4;
const BATCH_HEADER_ROW = 5;
const BATCH_FIRST_DATA_ROW = 6;

const statusStyle = (status) => {
  if (status === STATUS.better) return STYLES.statusBetter;
  if (status === STATUS.worse) return STYLES.statusWorse;
  return STYLES.statusNone;
};

const actualStyle = (metricValue) => (metricValue.estimated ? STYLES.estimated : STYLES[metricValue.state]);

const varianceStyle = (status) => {
  if (status === STATUS.better) return STYLES.better;
  if (status === STATUS.worse) return STYLES.worse;
  return STYLES.neutral;
};

const buildBatchSheet = ({ title, rows, metricIds, periodText }) => {
  const { sheet, put, merge, height, finish } = newSheet();
  const lastDataRow = BATCH_FIRST_DATA_ROW + rows.length - 1;
  const widths = ID_COLUMNS.map((column) => ({ wch: column.width }));

  put(0, 0, textCell(title, STYLES.sheetTitle));
  put(1, 0, textCell(periodText, STYLES.sheetSubtitle));
  height(0, 24);

  // Legend sits to the right of the frozen columns, with the longest label on the wide Category column
  [
    ['Standard', STYLES.legendStandard],
    ['Better', STYLES.legendBetter],
    ['Worse', STYLES.legendWorse],
    ['No actual: standard used', STYLES.legendEstimated],
    ['No compare', STYLES.legendNeutral],
  ].forEach(([label, cellStyle], index) => put(0, FROZEN_COLUMNS + index, textCell(label, cellStyle)));

  ID_COLUMNS.forEach((column, col) => {
    put(BATCH_GROUP_ROW, col, textCell('', STYLES.header));
    put(BATCH_HEADER_ROW, col, textCell(column.header, STYLES.header));
    put(BATCH_TOTAL_ROW, col, textCell('', STYLES.totalLabel));
  });
  put(BATCH_TOTAL_ROW, 0, textCell('Total (visible rows)', STYLES.totalLabel));
  merge(BATCH_TOTAL_ROW, 0, BATCH_TOTAL_ROW, FROZEN_COLUMNS - 1);

  const totalCell = (col, format, values) => {
    const letter = XLSX.utils.encode_col(col);
    return {
      t: 'n',
      f: `SUBTOTAL(109,${letter}${BATCH_FIRST_DATA_ROW + 1}:${letter}${lastDataRow + 1})`,
      v: values.reduce((total, value) => total + (value || 0), 0),
      z: format,
      s: STYLES.total,
    };
  };

  let col = ID_COLUMNS.length;
  const dataColumns = [];
  metricIds.forEach((id) => {
    const metric = METRICS[id];
    if (metric.single) {
      put(BATCH_GROUP_ROW, col, textCell(metric.label, STYLES.header));
      put(BATCH_HEADER_ROW, col, textCell('Actual', STYLES.header));
      put(BATCH_TOTAL_ROW, col, textCell('', STYLES.total));
      widths.push({ wch: metric.width });
      dataColumns.push({ col, cell: (row) => sortableNumberCell(row.metrics[id].actual, metric.format) });
      col += 1;
      return;
    }

    put(BATCH_GROUP_ROW, col, textCell(metric.label, STYLES.header));
    put(BATCH_GROUP_ROW, col + 1, textCell('', STYLES.header));
    merge(BATCH_GROUP_ROW, col, BATCH_GROUP_ROW, col + 1);
    put(BATCH_HEADER_ROW, col, textCell('Standard', STYLES.headerStandard));
    put(BATCH_HEADER_ROW, col + 1, textCell('Actual', STYLES.header));

    if (metric.additive) {
      put(BATCH_TOTAL_ROW, col, totalCell(col, metric.format, rows.map((row) => row.metrics[id].standard)));
      put(BATCH_TOTAL_ROW, col + 1, totalCell(col + 1, metric.format, rows.map((row) => row.metrics[id].actual)));
    } else {
      put(BATCH_TOTAL_ROW, col, textCell('', STYLES.total));
      put(BATCH_TOTAL_ROW, col + 1, textCell('', STYLES.total));
    }

    widths.push({ wch: metric.width }, { wch: metric.width });
    const standardCol = col;
    dataColumns.push(
      { col: standardCol, cell: (row) => sortableNumberCell(row.metrics[id].standard, metric.format, STYLES.standard) },
      { col: standardCol + 1, cell: (row) => sortableNumberCell(row.metrics[id].actual, metric.format, actualStyle(row.metrics[id])) },
    );
    col += 2;
  });

  put(BATCH_GROUP_ROW, col, textCell('HPP / Unit vs Standard', STYLES.header));
  put(BATCH_GROUP_ROW, col + 1, textCell('', STYLES.header));
  merge(BATCH_GROUP_ROW, col, BATCH_GROUP_ROW, col + 1);
  put(BATCH_HEADER_ROW, col, textCell('Variance', STYLES.header));
  put(BATCH_HEADER_ROW, col + 1, textCell('Status', STYLES.header));
  put(BATCH_TOTAL_ROW, col, textCell('', STYLES.total));
  put(BATCH_TOTAL_ROW, col + 1, textCell('', STYLES.total));
  widths.push({ wch: 11 }, { wch: 15 });
  const varianceCol = col;
  dataColumns.push(
    { col: varianceCol, cell: (row) => sortableNumberCell(row.variance, FORMAT.signedPercent, varianceStyle(row.status)) },
    { col: varianceCol + 1, cell: (row) => textCell(row.status, statusStyle(row.status)) },
  );

  rows.forEach((row, index) => {
    const r = BATCH_FIRST_DATA_ROW + index;
    ID_COLUMNS.forEach((column, c) => put(r, c, column.cell(row)));
    dataColumns.forEach(({ col: c, cell }) => put(r, c, cell(row)));
  });

  height(BATCH_GROUP_ROW, 22);
  height(BATCH_HEADER_ROW, 20);
  sheet['!cols'] = widths;
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: BATCH_HEADER_ROW, c: 0 },
      e: { r: lastDataRow, c: varianceCol + 1 },
    }),
  };
  return finish();
};

// ---------------------------------------------------------------------------
// Summary sheet
// ---------------------------------------------------------------------------

const SUMMARY_LAST_COL = 10;

const variancePercent = (actual, standard) => (standard > 0 ? actual / standard - 1 : null);

const buildSummarySheet = ({ title, period, groups, months, notes, info }) => {
  const { sheet, put, merge, height, finish } = newSheet();
  let r = 0;

  const band = (text, cellStyle, rowHeight) => {
    for (let c = 0; c <= SUMMARY_LAST_COL; c += 1) put(r, c, textCell(c === 0 ? text : '', cellStyle));
    merge(r, 0, r, SUMMARY_LAST_COL);
    height(r, rowHeight);
    r += 1;
  };

  band(title, STYLES.title, 30);
  band(period.label, STYLES.subtitle, 18);
  r += 1;

  band('Report Information', STYLES.section, 20);
  info.forEach(([label, value]) => {
    put(r, 0, textCell(label, STYLES.infoLabel));
    for (let c = 1; c <= 5; c += 1) put(r, c, textCell(c === 1 ? value : '', STYLES.infoValue));
    merge(r, 1, r, 5);
    r += 1;
  });
  r += 1;

  const resultColumns = ['Batches', 'Compared', 'Better', 'Worse', 'Not Compared', '% Better',
    'Standard Cost at Actual Output', 'Actual Cost', 'Variance', 'Variance %'];

  const resultTable = (sectionTitle, firstHeader, items) => {
    band(sectionTitle, STYLES.section, 20);
    [firstHeader, ...resultColumns].forEach((label, c) => {
      put(r, c, textCell(label, label === 'Standard Cost at Actual Output' ? STYLES.headerStandard : STYLES.header));
    });
    height(r, 44);
    r += 1;

    items.forEach(({ label, summary, bold }) => {
      const variance = summary.actualCost - summary.standardAtVolume;
      const state = compareToStandard(summary.actualCost, summary.standardAtVolume, 'lower');
      const hasComparison = summary.compared > 0;
      const numberStyle = bold ? STYLES.numberBold : STYLES.number;
      put(r, 0, textCell(label, bold ? STYLES.textBold : STYLES.text));
      put(r, 1, numberCell(summary.batches, FORMAT.integer, numberStyle));
      put(r, 2, numberCell(summary.compared, FORMAT.integer, numberStyle));
      put(r, 3, numberCell(summary.better, FORMAT.integer, STYLES.better));
      put(r, 4, numberCell(summary.worse, FORMAT.integer, STYLES.worse));
      put(r, 5, numberCell(summary.uncompared, FORMAT.integer, numberStyle));
      put(r, 6, numberCell(hasComparison ? summary.better / summary.compared : null, FORMAT.percent, numberStyle));
      put(r, 7, numberCell(hasComparison ? summary.standardAtVolume : null, FORMAT.integer, STYLES.standard));
      put(r, 8, numberCell(hasComparison ? summary.actualCost : null, FORMAT.integer, STYLES[state]));
      put(r, 9, numberCell(hasComparison ? variance : null, FORMAT.signedInteger, STYLES[state]));
      put(r, 10, numberCell(hasComparison ? variancePercent(summary.actualCost, summary.standardAtVolume) : null, FORMAT.signedPercent, STYLES[state]));
      r += 1;
    });
    r += 1;
  };

  resultTable('Result at a Glance', 'Product Group', groups.map((group) => ({
    label: group.label,
    summary: group.summary,
    bold: group.isTotal,
  })));

  band('Parameter Comparison', STYLES.section, 20);
  put(r, 0, textCell('', STYLES.header));
  put(r + 1, 0, textCell('Parameter', STYLES.header));
  groups.forEach((group, index) => {
    const start = 1 + index * 3;
    put(r, start, textCell(group.label, STYLES.header));
    put(r, start + 1, textCell('', STYLES.header));
    put(r, start + 2, textCell('', STYLES.header));
    merge(r, start, r, start + 2);
    put(r + 1, start, textCell('Standard', STYLES.headerStandard));
    put(r + 1, start + 1, textCell('Actual', STYLES.header));
    put(r + 1, start + 2, textCell('Variance %', STYLES.header));
  });
  r += 2;

  const parameterRow = (label, format, better, readValues) => {
    put(r, 0, textCell(label, STYLES.textBold));
    groups.forEach((group, index) => {
      const start = 1 + index * 3;
      const values = readValues(group.summary);
      const state = values ? compareToStandard(values.actual, values.standard, better) : 'neutral';
      put(r, start, numberCell(values?.standard ?? null, format, STYLES.standard));
      put(r, start + 1, numberCell(values?.actual ?? null, format, STYLES[state]));
      put(r, start + 2, numberCell(values ? variancePercent(values.actual, values.standard) : null, FORMAT.signedPercent, STYLES[state]));
    });
    r += 1;
  };

  SUMMARY_METRICS.forEach((id) => {
    const metric = METRICS[id];
    if (groups.every((group) => !group.summary.metrics[id])) return;
    parameterRow(metric.label, metric.format, metric.better, (summary) => summary.metrics[id]);
  });
  parameterRow('HPP / Unit (weighted by actual output)', FORMAT.integer, 'lower', (summary) => summary.perUnit);
  r += 1;

  if (months.length > 1) {
    resultTable('Monthly Trend', 'Month', months.map((month) => ({ label: month.label, summary: month.summary })));
  }

  band('Legend', STYLES.section, 20);
  [
    ['Standard', STYLES.legendStandard],
    ['Better than standard', STYLES.legendBetter],
    ['Worse than standard', STYLES.legendWorse],
    ['No comparison', STYLES.legendNeutral],
    ['No actual: standard used', STYLES.legendEstimated],
  ].forEach(([label, cellStyle], index) => put(r, index, textCell(label, cellStyle)));
  height(r, 30);
  for (let c = 0; c <= 4; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    cell.s = { ...cell.s, alignment: { ...cell.s.alignment, wrapText: true } };
  }
  r += 2;

  band('Notes', STYLES.section, 20);
  notes.forEach((note) => {
    put(r, 0, textCell(note, STYLES.note));
    merge(r, 0, r, SUMMARY_LAST_COL);
    height(r, note.length > 200 ? 30 : 16);
    r += 1;
  });

  sheet['!cols'] = [{ wch: 36 }, ...Array(SUMMARY_LAST_COL).fill({ wch: 16 })];
  return finish();
};

// ---------------------------------------------------------------------------
// Workbook assembly
// ---------------------------------------------------------------------------

const buildNotes = ({ rows, standardYears }) => {
  const notes = [
    `Standard values come from the HPP Standard of each batch's own year (${standardYears}) and describe one standard batch. Amounts are in Rupiah.`,
    'Actual values match the HPP Actual page. For OTC and Generic batches, Actual HPP also includes FOH + Depresiasi, which the Standard HPP does not include.',
    'Green means actual is at or better than standard: lower for costs and manhours, higher for Output and Rendemen. Red means worse. HPP / Unit decides the batch Status.',
    'Grey italic values have no recorded actual, so the standard is shown and not coloured. Zero or missing values are also not coloured.',
    'Standard Cost at Actual Output is Standard HPP / Unit x Actual Output, so batches larger or smaller than a standard batch do not distort the verdict.',
    'Parameter Comparison sums standard batches, so its cost totals also reflect output differences. Use HPP / Unit and Standard Cost at Actual Output for the like-for-like view.',
    'Not Compared batches have no usable standard (Status: No Standard), or no output, material cost or manhours where the standard expects them, or no product group when calculated (Status: Incomplete Actual). They are left out of Summary totals but stay listed in the batch sheets.',
    'Only finished product batches are included. Intermediates (Granulate and FG) have no HPP Standard to compare against.',
  ];

  const expiry = rows.filter((row) => row.compared).map((row) => row.metrics.expiry);
  const hasStandardExpiry = expiry.some((value) => value.standard > 0);
  if (hasStandardExpiry && expiry.every((value) => !(value.actual > 0))) {
    notes.push('Expiry Cost is included in Standard HPP but no actual expiry cost is recorded for this period, so Actual HPP excludes it.');
  }
  return notes;
};

const pad = (value) => String(value).padStart(2, '0');

const formatTimestamp = (date) => (
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
);

/**
 * xlsx-js-style cannot write sheet view options or styled empty cells, so add freeze panes,
 * gridline settings and empty cells by editing the sheet XML in the finished file.
 */
const applySheetViews = (bytes, views) => {
  const zip = XLSX.CFB.read(bytes, { type: 'buffer' });
  const emptyCellPattern = new RegExp(`<c r="([A-Z]+\\d+)" s="(\\d+)" t="str"><v>${EMPTY_CELL}</v></c>`, 'g');
  views.forEach(({ frozenRows, frozenColumns, showGridLines }, index) => {
    const entry = XLSX.CFB.find(zip, `/xl/worksheets/sheet${index + 1}.xml`);
    const attributes = `${showGridLines ? '' : 'showGridLines="0" '}workbookViewId="0"`;
    const pane = frozenRows
      ? `<pane xSplit="${frozenColumns}" ySplit="${frozenRows}" topLeftCell="${XLSX.utils.encode_cell({ r: frozenRows, c: frozenColumns })}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight"/>`
      : '';
    const xml = new TextDecoder().decode(entry.content)
      .replace(/<sheetView [^>]*\/>/, `<sheetView ${attributes}>${pane}</sheetView>`)
      .replace(emptyCellPattern, '<c r="$1" s="$2"/>');
    entry.content = new TextEncoder().encode(xml);
  });
  return XLSX.CFB.write(zip, { fileType: 'zip', type: 'array', compression: true });
};

/**
 * Build the report as .xlsx bytes.
 * @param {Object} params
 * @param {Array} params.batches - Batches from the period report endpoint
 * @param {Object} params.standards - Standards keyed by year then Product_ID
 * @param {{from: string, to: string, label: string}} params.period
 * @param {boolean} [params.testMode]
 * @param {string} [params.generatedBy]
 * @param {Date} [params.generatedAt]
 * @returns {Uint8Array}
 */
export const buildPeriodReport = ({ batches, standards, period, testMode = false, generatedBy = 'User', generatedAt = new Date() }) => {
  const rows = batches.map((batch) => buildRow(batch, standards)).sort(byProductThenPeriod);
  const ethicalRows = rows.filter((row) => isEthicalGroup(row.batch));
  const genericRows = rows.filter((row) => !isEthicalGroup(row.batch));

  const monthsInRange = listPeriodsBetween(period.from, period.to);
  const monthsWithData = monthsInRange.filter((month) => rows.some((row) => row.batch.Periode === month));
  const monthsWithoutData = monthsInRange.filter((month) => !monthsWithData.includes(month));
  const currentMonth = `${generatedAt.getFullYear()}${pad(generatedAt.getMonth() + 1)}`;
  const standardYears = [...new Set(monthsWithData.map((month) => month.substring(0, 4)))].join(', ');
  const rangeText = describeRange(period.from, period.to);
  const dataSource = testMode ? 'TEST data' : 'Production data';

  const groups = [
    { label: 'Ethical / OTC', summary: summarize(ethicalRows) },
    { label: 'Generic', summary: summarize(genericRows) },
    { label: 'All Batches', summary: summarize(rows), isTotal: true },
  ];

  const info = [
    ['Report Period', period.label],
    ['Date Range', rangeText],
    ['Months With Data', `${monthsWithData.length} of ${monthsInRange.length}`],
    ...(monthsWithoutData.length ? [['Months Without Data', monthsWithoutData.map(formatPeriodLabel).join(', ')]] : []),
    ...(monthsWithData.includes(currentMonth) ? [['Month in Progress', `${formatPeriodLabel(currentMonth)} is the current month, so its figures are partial`]] : []),
    ['Standard Basis', `HPP Standard ${standardYears}`],
    ['Data Source', dataSource],
    ['Generated', `${formatTimestamp(generatedAt)} by ${generatedBy}`],
  ];

  const titleSuffix = testMode ? ' (TEST DATA)' : '';
  const periodText = `${rangeText} | ${dataSource} | Standard and actual values per batch, amounts in Rupiah`;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildSummarySheet({
    title: `HPP Actual vs Standard Report${titleSuffix}`,
    period,
    groups,
    months: monthsWithData.map((month) => ({
      label: formatPeriodLabel(month),
      summary: summarize(rows.filter((row) => row.batch.Periode === month)),
    })),
    notes: buildNotes({ rows, standardYears }),
    info,
  }), 'Summary');

  const views = [{ showGridLines: false }];
  [
    { name: 'Ethical-OTC', title: 'Ethical / OTC Batches', rows: ethicalRows, metricIds: ETHICAL_METRICS },
    { name: 'Generic', title: 'Generic Batches', rows: genericRows, metricIds: GENERIC_METRICS },
  ].filter((sheet) => sheet.rows.length > 0).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, buildBatchSheet({
      title: `${sheet.title}${titleSuffix}`,
      rows: sheet.rows,
      metricIds: sheet.metricIds,
      periodText,
    }), sheet.name);
    views.push({ frozenRows: BATCH_FIRST_DATA_ROW, frozenColumns: FROZEN_COLUMNS, showGridLines: false });
  });

  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return applySheetViews(new Uint8Array(bytes), views);
};

export const buildPeriodReportFilename = (period, testMode, generatedAt = new Date()) => {
  const stamp = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}`;
  const range = period.from === period.to ? period.from : `${period.from}-${period.to}`;
  return `HPP_Period_Report_${range}${testMode ? '_TEST' : ''}_${stamp}.xlsx`;
};

export const downloadPeriodReport = (bytes, filename) => {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
