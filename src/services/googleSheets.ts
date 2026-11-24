import {
  ColumnMappingInfo,
  EquipmentModality,
  NormalizedStatus,
  ParsedSheetResult,
  RepairRecord,
} from '../types/repair';

export interface BackendSheetResponse {
  configured: boolean;
  mode: 'service_account' | 'public_sheet' | 'published_csv' | 'unconfigured';
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetName: string;
  availableSheets: string[];
  rows: string[][];
  fetchedAt: string;
  errorType?: 'private_sheet' | 'not_found' | 'api_error';
  error?: string;
}

export async function fetchAutoRepairRecords(options?: {
  spreadsheetId?: string;
  sheetName?: string;
}): Promise<BackendSheetResponse> {
  const params = new URLSearchParams();
  if (options?.spreadsheetId?.trim()) {
    params.set('spreadsheetId', options.spreadsheetId.trim());
  }
  if (options?.sheetName?.trim()) {
    params.set('sheetName', options.sheetName.trim());
  }

  const query = params.toString();
  const res = await fetch(`/api/repair-records${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Server returned ${res.status}`);
  }

  return (await res.json()) as BackendSheetResponse;
}

export function extractSpreadsheetIdFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return trimmed;
}

const THAI_MONTHS: Record<string, number> = {
  'ม.ค.': 0,
  'มกราคม': 0,
  'ก.พ.': 1,
  'กุมภาพันธ์': 1,
  'มี.ค.': 2,
  'มีนาคม': 2,
  'เม.ย.': 3,
  'เมษายน': 3,
  'พ.ค.': 4,
  'พฤษภาคม': 4,
  'มิ.ย.': 5,
  'มิถุนายน': 5,
  'ก.ค.': 6,
  'กรกฎาคม': 6,
  'ส.ค.': 7,
  'สิงหาคม': 7,
  'ก.ย.': 8,
  'กันยายน': 8,
  'ต.ค.': 9,
  'ตุลาคม': 9,
  'พ.ย.': 10,
  'พฤศจิกายน': 10,
  'ธ.ค.': 11,
  'ธันวาคม': 11,
};

const EN_MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function normalizeYear(yearNum: number): number {
  if (yearNum < 100) {
    if (yearNum >= 60) {
      return 2500 + yearNum - 543;
    }
    return 2000 + yearNum;
  }
  if (yearNum >= 2400) {
    return yearNum - 543;
  }
  return yearNum;
}

export function parseFlexibleDate(raw: string): Date | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = normalizeYear(parseInt(isoMatch[1], 10));
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime()) && d.getMonth() === month) return d;
  }

  const dmyMatch = cleaned.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:\s.*)?$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = normalizeYear(parseInt(dmyMatch[3], 10));
    let day = p1;
    let month = p2 - 1;
    if (p2 > 12 && p1 <= 12) {
      month = p1 - 1;
      day = p2;
    }
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime()) && d.getMonth() === month) return d;
  }

  const textMatch = cleaned.match(/^(\d{1,2})[\s\-/]+([^\s\d\-/]+)[\s\-/,]+(\d{2,4})$/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthToken = textMatch[2].toLowerCase().trim();
    const year = normalizeYear(parseInt(textMatch[3], 10));
    const month =
      THAI_MONTHS[textMatch[2].trim()] ??
      EN_MONTHS[monthToken] ??
      EN_MONTHS[monthToken.replace('.', '')];
    if (month !== undefined) {
      const d = new Date(year, month, day);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const parsed = new Date(cleaned);
  if (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() >= 1990 &&
    parsed.getFullYear() <= 2100
  ) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

export function calculateElapsedDays(reportDate: Date | null, now = new Date()): number | null {
  if (!reportDate) return null;
  const start = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function classifyModality(equipment: string, product: string): EquipmentModality {
  const combined = `${equipment} ${product}`.toLowerCase();

  if (
    /fluoro|fluro|fluroscot|c-arm|c\s*arm|mobile\s*c|oec|ziehm|veradius|cios|pulsera|endura|libra|zenition|zennition|\bzen\s*\d+|\bunity\b|arcos|fluorostar|exposcop|arcadis/.test(
      combined
    )
  ) {
    return 'fluoroscopy';
  }

  if (
    /ultrasound|ultra\s*sound|อัลตรา|อัลตร้า|\bus\b|sonosite|mindray|voluson|logiq|vivid|epiq|affiniti|\baf\s*\d+|clearvu|clearvua|lumify|vectra|acuson|aplio|arietta|aloka|prosound|vinno|chison|versana|venue|\b3300\b|\b5000\s*series|\b5100\s*poc|\b5300p\b/.test(
      combined
    )
  ) {
    return 'ultrasound';
  }

  return 'other';
}

export function normalizeRepairStatus(rawStatus: string): NormalizedStatus {
  const s = rawStatus.trim().toLowerCase();
  if (!s) return 'new_urgent';

  if (/ยกเลิก|cancel|void|reject/.test(s)) {
    return 'cancelled';
  }

  if (
    /เสร็จ|เรียบร้อย|ปิดงาน|ซ่อมได้|ปกติ|ส่งคืนแล้ว|ใช้งานได้|complete|completed|done|closed|close|fixed|finish|finished|pass|normal|ready|resolved/.test(
      s
    )
  ) {
    return 'completed';
  }

  if (
    /รออะไหล่|สั่งอะไหล่|รอของ|รออนุมัติ|รอเสนอราคา|wait.*part|waiting.*part|pending.*part|spare|price\s*offer|submit.*offer|quotation|on\s*hold|hold|awaiting|order.*part|waiting\s*po|\bpo\b/.test(
      s
    )
  ) {
    return 'waiting_parts';
  }

  if (
    /กำลัง|ดำเนินการ|เข้าซ่อม|ตรวจเช็ค|ประเมิน|แก้ไข|ส่งซ่อม|in\s*progress|progress|checking|repairing|working|on\s*site|onsite|testing|invoice|follow|active|process/.test(
      s
    )
  ) {
    return 'in_progress';
  }

  if (
    /แจ้งซ่อม|เปิดงาน|ด่วน|วิกฤต|รอตรวจ|รอคิว|ค้าง|เสีย|repair\s*request|new|open|urgent|critical|stat|down|pending|reported|breakdown|wait/.test(
      s
    )
  ) {
    return 'new_urgent';
  }

  return 'in_progress';
}

const HEADER_ALIASES = {
  reportDate: [
    'report date',
    'report_date',
    'reported date',
    'วันที่แจ้งงานซ่อม',
    'วันที่แจ้งซ่อม',
    'วันที่แจ้ง',
    'วันที่ซ่อม',
    'วันแจ้งซ่อม',
    'reportdate',
    'date',
    'day',
  ],
  hospital: [
    'hospital',
    'hospital name',
    'ชื่อโรงพยาบาล',
    'โรงพยาบาล',
    'customer',
    'site',
    'รพ.',
    'หน่วยงาน',
  ],
  equipment: [
    'equipment',
    'equipment name',
    'ชื่อเครื่อง',
    'เครื่อง',
    'machine',
    'device',
    'model',
    'รุ่น',
    'unit',
  ],
  product: ['product', 'modality', 'category', 'type', 'ประเภท', 'กลุ่มเครื่อง'],
  problem: [
    'problem',
    'อาการเสีย',
    'อาการ',
    'ปัญหา',
    'issue',
    'symptom',
    'fault',
    'defect',
    'detail',
    'details',
    'description',
    'รายละเอียด',
  ],
  status: ['status', 'สถานะงานซ่อม', 'สถานะ', 'job status', 'repair status', 'state'],
  irrsId: ['irrs-id', 'irrs id', 'job id', 'job no', 'ticket', 'case id', 'เลขที่ใบงาน', 'รหัสงาน'],
  serial: ['serial', 's/n', 'sn', 'serial no', 'serial number', 'หมายเลขเครื่อง'],
  engineer: ['engineer', 'tech', 'technician', 'ช่าง', 'ผู้รับผิดชอบ', 'วิศวกร'],
  sparepart: ['sparepart', 'spare part', 'parts', 'อะไหล่'],
  waybill: ['waybill', 'tracking', 'ใบส่งของ'],
  dayReturn: [
    'dayreturn',
    'day return',
    'return date',
    'finish date',
    'completed date',
    'วันที่ส่งคืน',
    'วันที่ปิดงาน',
    'วันที่ซ่อมเสร็จ',
  ],
};

function findColumnIndex(headers: string[], aliases: string[], usedIndices: Set<number>): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());

  for (const alias of aliases) {
    const idx = normalized.findIndex((h, i) => !usedIndices.has(i) && h === alias);
    if (idx !== -1) return idx;
  }

  for (const alias of aliases) {
    const idx = normalized.findIndex((h, i) => !usedIndices.has(i) && h.includes(alias));
    if (idx !== -1) return idx;
  }

  return -1;
}

function detectHeaderRowIndex(rows: string[][]): number {
  const keywords = [
    'hospital',
    'โรงพยาบาล',
    'equipment',
    'เครื่อง',
    'status',
    'สถานะ',
    'problem',
    'อาการ',
    'report date',
    'วันที่',
    'irrs',
  ];

  let bestRow = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const rowText = rows[i].map((c) => (c || '').toLowerCase()).join(' ');
    let score = 0;
    for (const kw of keywords) {
      if (rowText.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  return bestRow;
}

export function parseRepairRows(rows: string[][], now = new Date()): ParsedSheetResult {
  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell && cell.trim() !== ''));
  if (nonEmptyRows.length === 0) {
    return {
      records: [],
      headers: [],
      mapping: {
        reportDateCol: null,
        hospitalCol: null,
        equipmentCol: null,
        productCol: null,
        problemCol: null,
        statusCol: null,
      },
      totalRawRows: 0,
    };
  }

  const headerIdx = detectHeaderRowIndex(nonEmptyRows);
  const rawHeaders = nonEmptyRows[headerIdx].map((h, i) => (h || '').trim() || `Column ${i + 1}`);
  const dataRows = nonEmptyRows.slice(headerIdx + 1);

  const used = new Set<number>();
  const pick = (aliases: string[]): number => {
    const idx = findColumnIndex(rawHeaders, aliases, used);
    if (idx !== -1) used.add(idx);
    return idx;
  };

  const reportDateIdx = pick(HEADER_ALIASES.reportDate);
  const hospitalIdx = pick(HEADER_ALIASES.hospital);
  const equipmentIdx = pick(HEADER_ALIASES.equipment);
  const productIdx = pick(HEADER_ALIASES.product);
  const problemIdx = pick(HEADER_ALIASES.problem);
  const statusIdx = pick(HEADER_ALIASES.status);
  const irrsIdx = pick(HEADER_ALIASES.irrsId);
  const serialIdx = pick(HEADER_ALIASES.serial);
  const engineerIdx = pick(HEADER_ALIASES.engineer);
  const sparepartIdx = pick(HEADER_ALIASES.sparepart);
  const waybillIdx = pick(HEADER_ALIASES.waybill);
  const dayReturnIdx = pick(HEADER_ALIASES.dayReturn);

  const records: RepairRecord[] = [];

  dataRows.forEach((row, idx) => {
    const get = (colIdx: number) =>
      colIdx >= 0 && colIdx < row.length ? (row[colIdx] || '').trim() : '';

    const hospital = get(hospitalIdx);
    const equipment = get(equipmentIdx);
    const product = get(productIdx);
    const problem = get(problemIdx);
    const reportDateRaw = get(reportDateIdx);
    const statusRaw = get(statusIdx);

    if (!hospital && !equipment && !problem && !reportDateRaw) {
      return;
    }

    const reportDate = parseFlexibleDate(reportDateRaw);
    const elapsedDays = calculateElapsedDays(reportDate, now);
    const modality = classifyModality(equipment, product);
    const normalizedStatus = normalizeRepairStatus(statusRaw);

    const extraFields: Record<string, string> = {};
    rawHeaders.forEach((headerName, colIdx) => {
      const val = get(colIdx);
      if (val) {
        extraFields[headerName] = val;
      }
    });

    const irrsId = get(irrsIdx) || undefined;

    records.push({
      id: irrsId ? `${irrsId}-${idx}` : `row-${headerIdx + idx + 2}`,
      rowIndex: headerIdx + idx + 2,
      reportDateRaw,
      reportDate,
      hospital: hospital || 'ไม่ระบุโรงพยาบาล',
      equipment: equipment || product || 'ไม่ระบุรุ่นเครื่อง',
      product,
      modality,
      problem: problem || 'ไม่มีรายละเอียดอาการเสีย',
      statusRaw: statusRaw || 'รอดำเนินการ',
      normalizedStatus,
      elapsedDays,
      irrsId,
      serial: get(serialIdx) || undefined,
      engineer: get(engineerIdx) || undefined,
      sparepart: get(sparepartIdx) || undefined,
      waybill: get(waybillIdx) || undefined,
      dayReturn: get(dayReturnIdx) || undefined,
      extraFields,
    });
  });

  records.sort((a, b) => {
    if (a.reportDate && b.reportDate) {
      const diff = b.reportDate.getTime() - a.reportDate.getTime();
      if (diff !== 0) return diff;
    } else if (a.reportDate && !b.reportDate) {
      return -1;
    } else if (!a.reportDate && b.reportDate) {
      return 1;
    }
    return b.rowIndex - a.rowIndex;
  });

  const mapping: ColumnMappingInfo = {
    reportDateCol: reportDateIdx >= 0 ? rawHeaders[reportDateIdx] : null,
    hospitalCol: hospitalIdx >= 0 ? rawHeaders[hospitalIdx] : null,
    equipmentCol: equipmentIdx >= 0 ? rawHeaders[equipmentIdx] : null,
    productCol: productIdx >= 0 ? rawHeaders[productIdx] : null,
    problemCol: problemIdx >= 0 ? rawHeaders[problemIdx] : null,
    statusCol: statusIdx >= 0 ? rawHeaders[statusIdx] : null,
  };

  return {
    records,
    headers: rawHeaders,
    mapping,
    totalRawRows: dataRows.length,
  };
}
