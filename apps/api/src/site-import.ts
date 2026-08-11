import { inflateRawSync } from 'node:zlib';

export type SiteImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

const knownFieldNames = new Set([
  'name',
  'language',
  'groupId',
  'domainName',
  'status',
  'tmplId',
  'tdkId',
  'urlId',
  'seoTitle',
  'seoKeyword',
  'seoDesc',
  'remark',
  'icp',
  'picp',
  'statisticsCode',
  'baiduPush',
  'baiduVerifyCode',
  'shenmaPushAccount',
  'shenmaPushAuthkey',
  'toutiaoPush',
  'logo',
  'favicon',
  'siteName',
  'primaryDomain',
  'newsUpdateCount',
  'seoKeywords',
  'seoDescription',
  'analyticsCode',
  'baiduPushToken',
  'baiduVerify',
]);

export function parseSiteImportRows(dataBase64: string): SiteImportRow[] {
  const workbook = Buffer.from(dataBase64, 'base64');
  if (workbook.length < 4 || workbook.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('请上传有效的 .xlsx 表格文件。');
  }

  const entries = new Map(readZipEntries(workbook).map((entry) => [entry.name, entry.data]));
  const sheetPath = resolveFirstWorksheetPath(entries);
  const sheetXml = entries.get(sheetPath)?.toString('utf8');
  if (!sheetXml) {
    throw new Error('Excel 中没有找到可导入的工作表。');
  }
  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml')?.toString('utf8') ?? '');
  const rows = parseWorksheetRows(sheetXml, sharedStrings);
  const fieldRowIndex = rows.findIndex((row) => row.filter((cell) => knownFieldNames.has(cell.trim())).length >= 2);
  if (fieldRowIndex === -1) {
    throw new Error('没有找到字段映射行。请确认表格中包含 name、domainName、tmplId、tdkId、urlId 等字段。');
  }

  const fields = rows[fieldRowIndex].map((field) => field.trim());
  return rows
    .slice(fieldRowIndex + 1)
    .map((row, index) => ({
      rowNumber: fieldRowIndex + index + 2,
      values: Object.fromEntries(
        fields
          .map((field, columnIndex) => [field, (row[columnIndex] ?? '').trim()] as const)
          .filter(([field]) => field),
      ),
    }))
    .filter((row) => row.values.domainName || row.values.primaryDomain);
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Excel 文件目录损坏，无法读取。');
    }
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    entries.push({
      name,
      data: unzipEntry(compressedData, compressionMethod),
    });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      return index;
    }
  }
  throw new Error('Excel 文件目录损坏，无法读取。');
}

function unzipEntry(data: Buffer, method: number): Buffer {
  if (method === 0) {
    return data;
  }
  if (method === 8) {
    return inflateRawSync(data);
  }
  throw new Error(`Excel 使用了暂不支持的压缩方式：${method}`);
}

function resolveFirstWorksheetPath(entries: Map<string, Buffer>): string {
  const workbookXml = entries.get('xl/workbook.xml')?.toString('utf8') ?? '';
  const relsXml = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? '';
  const firstSheetRel = /<sheet\b[^>]*?(?:r:)?id="([^"]+)"/i.exec(workbookXml)?.[1];
  if (firstSheetRel) {
    const relPattern = new RegExp(`<Relationship\\b[^>]*Id="${escapeRegExp(firstSheetRel)}"[^>]*Target="([^"]+)"`, 'i');
    const target = relPattern.exec(relsXml)?.[1];
    if (target) {
      const normalized = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^xl\//, '')}`;
      if (entries.has(normalized)) {
        return normalized;
      }
    }
  }

  const fallback = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
  if (!fallback) {
    throw new Error('Excel 中没有找到可导入的工作表。');
  }
  return fallback;
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) {
    return [];
  }
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map((match) => textFromRichText(match[1]));
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2];
      const ref = /\br="([A-Z]+)(\d+)"/i.exec(attributes);
      if (!ref) continue;
      const columnIndex = columnNameToIndex(ref[1]);
      const rowIndex = Number(ref[2]) - 1;
      rows[rowIndex] ??= [];
      rows[rowIndex][columnIndex] = cellValue(attributes, body, sharedStrings);
    }
  }
  return rows.map((row) => row.map((cell) => cell ?? ''));
}

function cellValue(attributes: string, body: string, sharedStrings: string[]): string {
  const type = /\bt="([^"]+)"/i.exec(attributes)?.[1];
  if (type === 's') {
    const index = Number(textFromTag(body, 'v'));
    return Number.isFinite(index) ? sharedStrings[index] ?? '' : '';
  }
  if (type === 'inlineStr') {
    return textFromRichText(body);
  }
  return textFromTag(body, 'v') || textFromRichText(body);
}

function textFromRichText(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
    .map((match) => decodeXml(match[1]))
    .join('');
}

function textFromTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return match ? decodeXml(match[1]) : '';
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function columnNameToIndex(columnName: string): number {
  return columnName
    .toUpperCase()
    .split('')
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
