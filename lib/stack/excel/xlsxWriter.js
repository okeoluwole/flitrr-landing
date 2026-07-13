/**
 * STACK values-only XLSX writer (Bucket 3.5).
 *
 * Writes a minimal, valid .xlsx from plain sheet definitions: strings and
 * numbers only. The writer has no formula path at all, so a workbook it
 * produces cannot carry the model, only the computed figures. That is the
 * values-only guarantee, enforced structurally rather than by convention.
 *
 * An .xlsx is a zip of XML parts. The zip is assembled here by hand with
 * stored (uncompressed) entries, so the writer needs no compression library
 * and no dependency at all. Given the same sheets and the same date, the
 * bytes are identical, which keeps the whole thing unit-testable.
 *
 * Server-side only: it builds Buffers and is called from a server action.
 *
 * A sheet is { name, columnWidths?, rows }, where each row is an array of
 * cells. A cell is null (blank), a string, a number, or { v, style } with
 * style one of 'bold', 'money', 'moneyBold', 'percent', 'multiple'.
 */

// ── CRC32, table-based, the zip checksum ────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * The CRC32 of a buffer, as an unsigned 32-bit integer.
 *
 * @param {Buffer} buf
 * @returns {number}
 */
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ── XML helpers ─────────────────────────────────────────────────────────────

/**
 * Escape a string for XML text and attribute values.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * The A1-style column letters for a zero-based column index (0 is A, 26 is AA).
 *
 * @param {number} index
 * @returns {string}
 */
export function columnRef(index) {
  let ref = '';
  let n = index;
  while (n >= 0) {
    ref = String.fromCharCode(65 + (n % 26)) + ref;
    n = Math.floor(n / 26) - 1;
  }
  return ref;
}

// A number as Excel-safe text: floating-point noise trimmed, no locale.
function numberText(value) {
  return String(Number(value.toFixed(10)));
}

// ── Styles ──────────────────────────────────────────────────────────────────

// Cell style keys to cellXfs indices. Order matches the styles.xml below.
const STYLE_INDEX = {
  bold: 1,
  money: 2,
  moneyBold: 3,
  percent: 4,
  multiple: 5,
};

// Custom number formats start at id 164.
function stylesXml(moneyFormat) {
  const money = escapeXml(moneyFormat);
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3">' +
    `<numFmt numFmtId="164" formatCode="${money}"/>` +
    '<numFmt numFmtId="165" formatCode="0.0%"/>' +
    '<numFmt numFmtId="166" formatCode="0.00&quot;x&quot;"/>' +
    '</numFmts>' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="2">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '</fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
    '<cellXfs count="6">' +
    '<xf/>' +
    '<xf fontId="1" applyFont="1"/>' +
    '<xf numFmtId="164" applyNumberFormat="1"/>' +
    '<xf numFmtId="164" fontId="1" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="165" applyNumberFormat="1"/>' +
    '<xf numFmtId="166" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '</styleSheet>'
  );
}

// ── Worksheet XML ───────────────────────────────────────────────────────────

function cellXml(cell, rowIndex, colIndex) {
  if (cell === null || cell === undefined) return '';

  const raw = typeof cell === 'object' ? cell.v : cell;
  if (raw === null || raw === undefined) return '';

  const ref = `${columnRef(colIndex)}${rowIndex + 1}`;
  const style = typeof cell === 'object' ? STYLE_INDEX[cell.style] ?? 0 : 0;
  const styleAttr = style ? ` s="${style}"` : '';

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '';
    return `<c r="${ref}"${styleAttr}><v>${numberText(raw)}</v></c>`;
  }

  return (
    `<c r="${ref}"${styleAttr} t="inlineStr">` +
    `<is><t xml:space="preserve">${escapeXml(raw)}</t></is></c>`
  );
}

function worksheetXml(sheet) {
  const cols = (sheet.columnWidths ?? [])
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const rows = sheet.rows
    .map((row, r) => {
      const cells = row.map((cell, c) => cellXml(cell, r, c)).join('');
      return cells ? `<row r="${r + 1}">${cells}</row>` : '';
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${rows}</sheetData>` +
    '</worksheet>'
  );
}

// ── Package parts ───────────────────────────────────────────────────────────

function contentTypesXml(sheetCount) {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    overrides +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>'
  );
}

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

function workbookXml(sheets) {
  const entries = sheets
    .map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${entries}</sheets>` +
    '</workbook>'
  );
}

function workbookRelsXml(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets +
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>'
  );
}

// ── Zip container, stored entries only ──────────────────────────────────────

// The MS-DOS date and time pair a zip entry carries. Dates before 1980 clamp
// to the format's floor.
function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  return { dosDate, dosTime };
}

function zip(entries, date) {
  const { dosDate, dosTime } = dosDateTime(date);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { path, content } of entries) {
    const name = Buffer.from(path, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size (stored)
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method: stored
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    // Extra, comment, disk, internal and external attributes all zero.
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // entries total
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16); // central directory offset
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, ...centrals, end]);
}

// ── The public entry point ──────────────────────────────────────────────────

/**
 * Write a values-only workbook to .xlsx bytes.
 *
 * @param {{ moneyFormat: string, sheets: Array<{ name: string, columnWidths?: number[], rows: Array<Array<null|string|number|{ v: string|number, style?: string }>> }> }} workbook
 * @param {{ date?: Date }} [options] the timestamp stamped on the zip entries;
 *   a fixed default keeps the bytes deterministic for tests
 * @returns {Buffer}
 */
export function writeWorkbook(workbook, options = {}) {
  const { moneyFormat, sheets } = workbook;
  const date = options.date ?? new Date('2026-01-01T00:00:00');

  const entries = [
    { path: '[Content_Types].xml', content: contentTypesXml(sheets.length) },
    { path: '_rels/.rels', content: ROOT_RELS },
    { path: 'xl/workbook.xml', content: workbookXml(sheets) },
    { path: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheets.length) },
    { path: 'xl/styles.xml', content: stylesXml(moneyFormat) },
    ...sheets.map((sheet, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      content: worksheetXml(sheet),
    })),
  ];

  return zip(entries, date);
}
