import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface SheetApiResponse {
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

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

let cachedServiceToken: CachedToken | null = null;

const SPREADSHEET_ID_REGEX = /^[a-zA-Z0-9-_]{10,120}$/;

function isValidSpreadsheetId(value: string): boolean {
  return SPREADSHEET_ID_REGEX.test(value.trim());
}

function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonEnv) {
    try {
      const parsed = JSON.parse(jsonEnv) as {
        client_email?: string;
        private_key?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email.trim(),
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch {
      // ignore invalid json and fall back to separate env vars
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (email && key) {
    return {
      clientEmail: email,
      privateKey: key.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getServiceAccountAccessToken(
  creds: ServiceAccountCredentials
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    cachedServiceToken &&
    cachedServiceToken.expiresAtMs > Date.now() + 60_000
  ) {
    return cachedServiceToken.accessToken;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: creds.clientEmail,
      scope:
        'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(creds.privateKey));
  const assertion = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Service Account auth failed (${tokenRes.status}): ${text}`);
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenJson.access_token) {
    throw new Error('Google OAuth token response did not include access_token');
  }

  const ttlMs = ((tokenJson.expires_in || 3600) - 120) * 1000;
  cachedServiceToken = {
    accessToken: tokenJson.access_token,
    expiresAtMs: Date.now() + Math.max(ttlMs, 60_000),
  };

  return tokenJson.access_token;
}

async function discoverPmAllByServiceAccount(
  accessToken: string
): Promise<{ id: string; name: string } | null> {
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'PM All' and trashed=false",
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '10',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    files?: Array<{ id: string; name: string }>;
  };
  const files = data.files || [];
  if (files.length === 0) return null;
  const exact = files.find((f) => f.name.trim().toLowerCase() === 'pm all');
  return exact || files[0];
}

export function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const normalized = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

async function fetchViaServiceAccount(
  creds: ServiceAccountCredentials,
  requestedSpreadsheetId: string,
  requestedSheetName: string
): Promise<SheetApiResponse> {
  const accessToken = await getServiceAccountAccessToken(creds);

  let spreadsheetId = requestedSpreadsheetId;
  if (!spreadsheetId) {
    const discovered = await discoverPmAllByServiceAccount(accessToken);
    if (!discovered) {
      return {
        configured: true,
        mode: 'service_account',
        spreadsheetId: '',
        spreadsheetTitle: 'PM All',
        sheetName: requestedSheetName,
        availableSheets: [],
        rows: [],
        fetchedAt: new Date().toISOString(),
        errorType: 'not_found',
        error:
          'Service Account เชื่อมต่อแล้ว แต่ยังไม่พบไฟล์ "PM All" (กรุณาแชร์ไฟล์ PM All ให้สิทธิ์ Viewer แก่ Service Account หรือกำหนด GOOGLE_SPREADSHEET_ID)',
      };
    }
    spreadsheetId = discovered.id;
  }

  const metaParams = new URLSearchParams({
    fields: 'spreadsheetId,properties.title,sheets.properties.title',
  });
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?${metaParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(
      `ไม่สามารถอ่าน Google Sheet (${metaRes.status}): ${errText}`
    );
  }

  const meta = (await metaRes.json()) as {
    spreadsheetId: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  const availableSheets = (meta.sheets || [])
    .map((s) => s.properties?.title || '')
    .filter(Boolean);

  const matchedTab =
    availableSheets.find(
      (s) => s.trim().toLowerCase() === requestedSheetName.trim().toLowerCase()
    ) ||
    availableSheets.find((s) => s.toLowerCase().includes('cm')) ||
    availableSheets[0] ||
    requestedSheetName;

  const range = `'${matchedTab.replace(/'/g, "''")}'!A1:Z2000`;
  const valParams = new URLSearchParams({
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const valRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}?${valParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!valRes.ok) {
    const errText = await valRes.text();
    throw new Error(`ไม่สามารถดึงข้อมูลแผ่นงาน "${matchedTab}": ${errText}`);
  }

  const valJson = (await valRes.json()) as { values?: string[][] };

  return {
    configured: true,
    mode: 'service_account',
    spreadsheetId: meta.spreadsheetId,
    spreadsheetTitle: meta.properties?.title || 'PM All',
    sheetName: matchedTab,
    availableSheets,
    rows: valJson.values || [],
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchViaPublicSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<SheetApiResponse> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';

  // If Google redirected to accounts.google.com login HTML, sheet is private
  if (
    !res.ok ||
    contentType.includes('text/html') ||
    text.trimStart().startsWith('<!DOCTYPE html') ||
    text.trimStart().startsWith('<html')
  ) {
    return {
      configured: true,
      mode: 'public_sheet',
      spreadsheetId,
      spreadsheetTitle: 'PM All',
      sheetName,
      availableSheets: [sheetName],
      rows: [],
      fetchedAt: new Date().toISOString(),
      errorType: 'private_sheet',
      error:
        'ไฟล์ Google Sheet นี้ยังถูกตั้งค่าเป็นส่วนตัว (Private) กรุณาแชร์สิทธิ์เป็น "ทุกคนที่มีลิงก์สามารถดูได้" หรือตั้งค่า Google Service Account ใน Environment Variables',
    };
  }

  const rows = parseCsvMatrix(text);
  return {
    configured: true,
    mode: 'public_sheet',
    spreadsheetId,
    spreadsheetTitle: 'PM All',
    sheetName,
    availableSheets: [sheetName],
    rows,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchViaPublishedCsvUrl(
  csvUrl: string,
  sheetName: string
): Promise<SheetApiResponse> {
  const parsed = new URL(csvUrl);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'docs.google.com') {
    throw new Error(
      'GOOGLE_PUBLISHED_CSV_URL ต้องเป็นลิงก์ https://docs.google.com/... เท่านั้น'
    );
  }

  const res = await fetch(parsed.toString(), { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`ไม่สามารถดึงข้อมูลจาก CSV URL (${res.status})`);
  }

  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html') || text.trimStart().startsWith('<html')) {
    throw new Error('ลิงก์ CSV ส่งกลับมาเป็นหน้า HTML กรุณาตรวจสอบสิทธิ์การเผยแพร่เว็บ');
  }

  return {
    configured: true,
    mode: 'published_csv',
    spreadsheetId: '',
    spreadsheetTitle: 'PM All',
    sheetName,
    availableSheets: [sheetName],
    rows: parseCsvMatrix(text),
    fetchedAt: new Date().toISOString(),
  };
}

const DEFAULT_SPREADSHEET_ID = '1wBbN1127iViI_0pXZU2RUoVeuSxQfZsI0qoIgxaaO4s';
const DEFAULT_SHEET_NAME = 'CM Record';

export async function getRepairSheetPayload(params: {
  spreadsheetId?: string;
  sheetName?: string;
}): Promise<SheetApiResponse> {
  const envSpreadsheetId = (process.env.GOOGLE_SPREADSHEET_ID || '').trim();
  const querySpreadsheetId = (params.spreadsheetId || '').trim();

  let targetSpreadsheetId = envSpreadsheetId || DEFAULT_SPREADSHEET_ID;
  if (querySpreadsheetId) {
    if (!isValidSpreadsheetId(querySpreadsheetId)) {
      return {
        configured: false,
        mode: 'unconfigured',
        spreadsheetId: '',
        spreadsheetTitle: 'PM All',
        sheetName: DEFAULT_SHEET_NAME,
        availableSheets: [],
        rows: [],
        fetchedAt: new Date().toISOString(),
        errorType: 'api_error',
        error: 'รูปแบบ Google Spreadsheet ID ไม่ถูกต้อง',
      };
    }
    targetSpreadsheetId = querySpreadsheetId;
  }

  const envSheetName = (process.env.GOOGLE_SHEET_NAME || '').trim();
  const safeEnvSheetName =
    envSheetName && !/\.(xlsx|xls|csv)$/i.test(envSheetName)
      ? envSheetName
      : '';

  const targetSheetName =
    (params.sheetName || '').trim() ||
    safeEnvSheetName ||
    DEFAULT_SHEET_NAME;

  const serviceCreds = getServiceAccountCredentials();
  const publishedCsvUrl = (process.env.GOOGLE_PUBLISHED_CSV_URL || '').trim();

  if (serviceCreds) {
    try {
      return await fetchViaServiceAccount(
        serviceCreds,
        targetSpreadsheetId,
        targetSheetName
      );
    } catch (err) {
      return {
        configured: true,
        mode: 'service_account',
        spreadsheetId: targetSpreadsheetId,
        spreadsheetTitle: 'PM All',
        sheetName: targetSheetName,
        availableSheets: [],
        rows: [],
        fetchedAt: new Date().toISOString(),
        errorType: 'api_error',
        error:
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Service Account',
      };
    }
  }

  if (targetSpreadsheetId) {
    if (!isValidSpreadsheetId(targetSpreadsheetId)) {
      return {
        configured: false,
        mode: 'unconfigured',
        spreadsheetId: '',
        spreadsheetTitle: 'PM All',
        sheetName: targetSheetName,
        availableSheets: [],
        rows: [],
        fetchedAt: new Date().toISOString(),
        errorType: 'api_error',
        error: 'GOOGLE_SPREADSHEET_ID ไม่ถูกต้อง',
      };
    }
    try {
      return await fetchViaPublicSheet(targetSpreadsheetId, targetSheetName);
    } catch (err) {
      return {
        configured: true,
        mode: 'public_sheet',
        spreadsheetId: targetSpreadsheetId,
        spreadsheetTitle: 'PM All',
        sheetName: targetSheetName,
        availableSheets: [targetSheetName],
        rows: [],
        fetchedAt: new Date().toISOString(),
        errorType: 'api_error',
        error:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถโหลดข้อมูลจาก Google Sheet ได้',
      };
    }
  }

  if (publishedCsvUrl) {
    try {
      return await fetchViaPublishedCsvUrl(publishedCsvUrl, targetSheetName);
    } catch (err) {
      return {
        configured: true,
        mode: 'published_csv',
        spreadsheetId: '',
        spreadsheetTitle: 'PM All',
        sheetName: targetSheetName,
        availableSheets: [targetSheetName],
        rows: [],
        fetchedAt: new Date().toISOString(),
        errorType: 'api_error',
        error:
          err instanceof Error
            ? err.message
            : 'ไม่สามารถโหลดข้อมูลจาก Published CSV URL ได้',
      };
    }
  }

  return {
    configured: false,
    mode: 'unconfigured',
    spreadsheetId: '',
    spreadsheetTitle: 'PM All',
    sheetName: targetSheetName,
    availableSheets: [],
    rows: [],
    fetchedAt: new Date().toISOString(),
  };
}

interface VercelLikeRequest extends IncomingMessage {
  query?: Record<string, unknown>;
}

interface VercelLikeResponse extends ServerResponse {
  status?: (code: number) => VercelLikeResponse;
  json?: (body: unknown) => void;
}

function sendJson(res: VercelLikeResponse, statusCode: number, body: unknown): void {
  const statusFn = res.status;
  const jsonFn = res.json;
  if (typeof statusFn === 'function' && typeof jsonFn === 'function') {
    const target = statusFn.call(res, statusCode);
    const targetJson = target?.json ?? jsonFn;
    targetJson.call(target || res, body);
  } else {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  }
}

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<void> {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const spreadsheetId =
    (typeof req.query?.spreadsheetId === 'string'
      ? req.query.spreadsheetId
      : parsedUrl.searchParams.get('spreadsheetId')) || undefined;
  const sheetName =
    (typeof req.query?.sheetName === 'string'
      ? req.query.sheetName
      : parsedUrl.searchParams.get('sheetName')) || undefined;

  const payload = await getRepairSheetPayload({ spreadsheetId, sheetName });

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  sendJson(res, 200, payload);
}
