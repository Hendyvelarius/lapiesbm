import XLSX from 'xlsx-js-style';

/**
 * Reusable Excel export utility with color-coded styling support.
 * 
 * Usage:
 *   exportToExcel({
 *     filename: 'MyExport',
 *     sheetName: 'Data',
 *     title: 'Report Title',
 *     subtitle: 'Optional subtitle',
 *     columns: [
 *       { header: 'Name', key: 'name', width: 25 },
 *       { header: 'Value', key: 'value', width: 15, type: 'currency' },
 *       { header: 'Status', key: 'status', width: 12 },
 *     ],
 *     data: [...],
 *     getCellStyle: (row, colIndex, column) => ({ fill: '4CAF50', fontColor: 'FFFFFF' }),
 *   });
 */

// Predefined color palette matching the app's CSS
const COLORS = {
  headerBg: '2C3E50',        // Dark header background
  headerFont: 'FFFFFF',      // White header text
  greenBg: 'D4EDDA',         // Light green background
  greenFont: '155724',        // Dark green text
  redBg: 'F8D7DA',           // Light red background
  redFont: '721C24',          // Dark red text
  yellowBg: 'FFF3CD',        // Light yellow background
  yellowFont: '856404',       // Dark yellow text
  blueBg: 'CCE5FF',          // Light blue background
  blueFont: '004085',        // Dark blue text
  grayBg: 'E2E3E5',          // Light gray background
  grayFont: '383D41',        // Dark gray text
  orangeBg: 'FFE0B2',        // Light orange background
  orangeFont: 'E65100',      // Dark orange text
  altRowBg: 'F8F9FA',        // Alternating row background
  white: 'FFFFFF',
  black: '000000',
  borderColor: 'DEE2E6',
};

const defaultBorder = {
  top: { style: 'thin', color: { rgb: COLORS.borderColor } },
  bottom: { style: 'thin', color: { rgb: COLORS.borderColor } },
  left: { style: 'thin', color: { rgb: COLORS.borderColor } },
  right: { style: 'thin', color: { rgb: COLORS.borderColor } },
};

const headerStyle = {
  font: { bold: true, color: { rgb: COLORS.headerFont }, sz: 11 },
  fill: { fgColor: { rgb: COLORS.headerBg } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: defaultBorder,
};

const titleStyle = {
  font: { bold: true, sz: 14, color: { rgb: COLORS.headerBg } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const subtitleStyle = {
  font: { sz: 10, color: { rgb: '6C757D' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const buildCellStyle = (styleConfig = {}, isAltRow = false) => {
  const style = {
    font: { sz: 10, color: { rgb: styleConfig.fontColor || COLORS.black } },
    fill: { fgColor: { rgb: styleConfig.fill || (isAltRow ? COLORS.altRowBg : COLORS.white) } },
    alignment: { 
      horizontal: styleConfig.align || 'left', 
      vertical: 'center',
      wrapText: styleConfig.wrapText || false,
    },
    border: defaultBorder,
  };
  if (styleConfig.bold) style.font.bold = true;
  return style;
};

const formatCurrencyValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumberValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatPercentValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${parseFloat(value).toFixed(2)}%`;
};

/**
 * Format a cell value based on column type
 */
const formatValue = (value, type) => {
  switch (type) {
    case 'currency': return formatCurrencyValue(value);
    case 'number': return formatNumberValue(value);
    case 'percent': return formatPercentValue(value);
    default: return value ?? '';
  }
};

/**
 * Main export function.
 * 
 * @param {Object} config
 * @param {string} config.filename - Base filename (without extension)
 * @param {string} [config.sheetName='Data'] - Excel sheet name
 * @param {string} [config.title] - Title row at top of sheet
 * @param {string} [config.subtitle] - Subtitle row below title
 * @param {Array} config.columns - Column definitions: { header, key, width, type, align }
 *   - type: 'text'|'currency'|'number'|'percent'
 *   - align: 'left'|'center'|'right'
 * @param {Array} config.data - Array of row objects
 * @param {Function} [config.getCellStyle] - (rowData, colIndex, column, rowIndex) => style object or null
 *   Style object: { fill: 'HEXCOLOR', fontColor: 'HEXCOLOR', bold: boolean, align: string }
 * @param {Function} [config.getValue] - (rowData, column) => custom display value
 * @param {Array} [config.summaryRows] - Array of { label, colSpan, values: { [colKey]: value } } for footer rows
 */
export const exportToExcel = ({
  filename,
  sheetName = 'Data',
  title,
  subtitle,
  columns,
  data,
  getCellStyle,
  getValue,
  summaryRows,
}) => {
  const wb = XLSX.utils.book_new();
  const wsData = [];
  let currentRow = 0;

  // Title row
  if (title) {
    const titleRow = [title, ...Array(columns.length - 1).fill('')];
    wsData.push(titleRow);
    currentRow++;
  }

  // Subtitle row
  if (subtitle) {
    const subRow = [subtitle, ...Array(columns.length - 1).fill('')];
    wsData.push(subRow);
    currentRow++;
  }

  // Empty spacer row if we have title/subtitle
  if (title || subtitle) {
    wsData.push(Array(columns.length).fill(''));
    currentRow++;
  }

  const headerRowIdx = currentRow;

  // Header row
  wsData.push(columns.map(c => c.header));
  currentRow++;

  // Data rows
  data.forEach((row) => {
    const rowArr = columns.map(col => {
      if (getValue) {
        const customVal = getValue(row, col);
        if (customVal !== undefined) return customVal;
      }
      const rawVal = typeof col.key === 'function' ? col.key(row) : row[col.key];
      return formatValue(rawVal, col.type);
    });
    wsData.push(rowArr);
    currentRow++;
  });

  // Summary rows
  if (summaryRows && summaryRows.length > 0) {
    wsData.push(Array(columns.length).fill('')); // spacer
    currentRow++;
    summaryRows.forEach(sr => {
      const row = Array(columns.length).fill('');
      if (sr.label) row[0] = sr.label;
      if (sr.values) {
        columns.forEach((col, i) => {
          if (sr.values[col.key] !== undefined) {
            row[i] = sr.values[col.key];
          }
        });
      }
      wsData.push(row);
      currentRow++;
    });
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Apply styles
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };

      // Title row
      if (title && R === 0) {
        ws[cellRef].s = titleStyle;
        continue;
      }

      // Subtitle row
      if (subtitle && R === (title ? 1 : 0)) {
        ws[cellRef].s = subtitleStyle;
        continue;
      }

      // Header row
      if (R === headerRowIdx) {
        ws[cellRef].s = headerStyle;
        continue;
      }

      // Data rows
      const dataRowIdx = R - headerRowIdx - 1;
      if (dataRowIdx >= 0 && dataRowIdx < data.length) {
        const isAltRow = dataRowIdx % 2 === 1;
        let cellStyle = {};

        // Get custom style from callback
        if (getCellStyle) {
          const customStyle = getCellStyle(data[dataRowIdx], C, columns[C], dataRowIdx);
          if (customStyle) cellStyle = customStyle;
        }

        // Default alignment based on column type
        if (!cellStyle.align) {
          const colType = columns[C]?.type;
          if (colType === 'currency' || colType === 'number' || colType === 'percent') {
            cellStyle.align = 'right';
          }
        }

        ws[cellRef].s = buildCellStyle(cellStyle, isAltRow);
        continue;
      }

      // Summary rows styling
      if (summaryRows && dataRowIdx >= data.length) {
        ws[cellRef].s = buildCellStyle({ bold: true, fill: COLORS.grayBg, align: C === 0 ? 'left' : 'right' });
      }
    }
  }

  // Merge title cell across all columns
  if (title) {
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } });
  }
  if (subtitle) {
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({ s: { r: title ? 1 : 0, c: 0 }, e: { r: title ? 1 : 0, c: columns.length - 1 } });
  }

  // Column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

  // Row heights - taller header
  ws['!rows'] = [];
  ws['!rows'][headerRowIdx] = { hpt: 30 };

  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
};

export { COLORS };
export default exportToExcel;
