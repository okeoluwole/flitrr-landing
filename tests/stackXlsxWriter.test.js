import { describe, it, expect } from 'vitest';
import {
  writeWorkbook,
  crc32,
  escapeXml,
  columnRef,
} from '../lib/stack/excel/xlsxWriter.js';

/**
 * Bucket 3.5: the values-only xlsx writer. The tests prove the container is a
 * well-formed zip of the expected parts, that strings and numbers land as
 * inline strings and plain values, that the bytes are deterministic, and above
 * all that no formula element can appear anywhere in the file: the writer has
 * no formula path, and the byte-level check pins that guarantee down.
 */

const FIXED_DATE = new Date('2026-07-13T12:00:00');

function sampleWorkbook() {
  return {
    moneyFormat: '"£"#,##0',
    sheets: [
      {
        name: 'Summary',
        columnWidths: [30, 14],
        rows: [
          [{ v: 'Flitrr STACK', style: 'bold' }],
          ['Project profit', { v: 614632.69, style: 'money' }],
          ['Profit on cost', { v: 0.2154, style: 'percent' }],
          ['Multiple', { v: 1.42, style: 'multiple' }],
          [null, 'A & B <ltd> "quoted"'],
          [],
          [42],
        ],
      },
      {
        name: 'Cashflow',
        rows: [[1, 'Jul 26', -525000]],
      },
    ],
  };
}

function build() {
  return writeWorkbook(sampleWorkbook(), { date: FIXED_DATE });
}

// Pull one stored entry's content back out of the zip by scanning local file
// headers. Entries are stored, not deflated, so the bytes read back directly.
function readEntry(buf, path) {
  let offset = 0;
  while (buf.readUInt32LE(offset) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const size = buf.readUInt32LE(offset + 18);
    const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
    const start = offset + 30 + nameLen + extraLen;
    if (name === path) return buf.toString('utf8', start, start + size);
    offset = start + size;
  }
  return null;
}

describe('the zip container', () => {
  it('opens with a local header and closes with the end of central directory', () => {
    const buf = build();
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50);
  });

  it('holds the five package parts plus one worksheet per sheet', () => {
    const buf = build();
    // 5 fixed parts + 2 sheets, counted in the end record.
    expect(buf.readUInt16LE(buf.length - 22 + 10)).toBe(7);
    for (const path of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]) {
      expect(readEntry(buf, path), path).not.toBeNull();
    }
  });

  it('stamps a correct CRC32 on every entry', () => {
    const buf = build();
    let offset = 0;
    let checked = 0;
    while (buf.readUInt32LE(offset) === 0x04034b50) {
      const declared = buf.readUInt32LE(offset + 14);
      const nameLen = buf.readUInt16LE(offset + 26);
      const size = buf.readUInt32LE(offset + 18);
      const start = offset + 30 + nameLen;
      expect(crc32(buf.subarray(start, start + size))).toBe(declared);
      checked += 1;
      offset = start + size;
    }
    expect(checked).toBe(7);
  });

  it('is byte-for-byte deterministic for the same workbook and date', () => {
    expect(build().equals(build())).toBe(true);
  });
});

describe('the worksheet XML', () => {
  it('writes strings as inline strings and numbers as values', () => {
    const sheet = readEntry(build(), 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('<is><t xml:space="preserve">Flitrr STACK</t></is>');
    expect(sheet).toContain('<v>614632.69</v>');
    expect(sheet).toContain('<v>42</v>');
  });

  it('addresses cells in A1 style, skipping blanks without losing the column', () => {
    const sheet = readEntry(build(), 'xl/worksheets/sheet1.xml');
    // Row 5 starts with a null cell, so its string lands in column B.
    expect(sheet).toContain('<c r="B5"');
    expect(sheet).not.toContain('<c r="A5"');
  });

  it('escapes XML metacharacters in strings', () => {
    const sheet = readEntry(build(), 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('A &amp; B &lt;ltd&gt; &quot;quoted&quot;');
  });

  it('maps the style keys onto the styles part, money format included', () => {
    const buf = build();
    const sheet = readEntry(buf, 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('s="1"'); // bold
    expect(sheet).toContain('s="2"'); // money
    expect(sheet).toContain('s="4"'); // percent
    expect(sheet).toContain('s="5"'); // multiple
    const styles = readEntry(buf, 'xl/styles.xml');
    expect(styles).toContain('&quot;£&quot;#,##0');
    expect(styles).toContain('0.0%');
  });

  it('names the sheets in the workbook part', () => {
    const workbook = readEntry(build(), 'xl/workbook.xml');
    expect(workbook).toContain('name="Summary"');
    expect(workbook).toContain('name="Cashflow"');
  });
});

describe('the values-only guarantee', () => {
  it('emits no formula element anywhere in the file', () => {
    const text = build().toString('latin1');
    expect(text).not.toContain('<f>');
    expect(text).not.toContain('<f ');
  });
});

describe('the helpers', () => {
  it('crc32 matches the known check vector', () => {
    expect(crc32(Buffer.from('123456789', 'ascii'))).toBe(0xcbf43926);
  });

  it('columnRef runs A, Z, AA, AZ, BA', () => {
    expect(columnRef(0)).toBe('A');
    expect(columnRef(25)).toBe('Z');
    expect(columnRef(26)).toBe('AA');
    expect(columnRef(51)).toBe('AZ');
    expect(columnRef(52)).toBe('BA');
  });

  it('escapeXml covers the five metacharacters', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
});
