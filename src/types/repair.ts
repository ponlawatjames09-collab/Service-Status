export type EquipmentModality = 'fluoroscopy' | 'ultrasound' | 'other';

export type NormalizedStatus =
  | 'new_urgent'
  | 'in_progress'
  | 'waiting_parts'
  | 'completed'
  | 'cancelled';

export interface RepairRecord {
  id: string;
  rowIndex: number;
  reportDateRaw: string;
  reportDate: Date | null;
  hospital: string;
  equipment: string;
  product: string;
  modality: EquipmentModality;
  problem: string;
  statusRaw: string;
  normalizedStatus: NormalizedStatus;
  elapsedDays: number | null;
  irrsId?: string;
  serial?: string;
  engineer?: string;
  sparepart?: string;
  waybill?: string;
  dayReturn?: string;
  extraFields: Record<string, string>;
}

export interface SpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: string[];
}

export interface ColumnMappingInfo {
  reportDateCol: string | null;
  hospitalCol: string | null;
  equipmentCol: string | null;
  productCol: string | null;
  problemCol: string | null;
  statusCol: string | null;
}

export interface ParsedSheetResult {
  records: RepairRecord[];
  headers: string[];
  mapping: ColumnMappingInfo;
  totalRawRows: number;
}
