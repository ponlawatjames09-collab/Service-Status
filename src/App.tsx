import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Moon,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import {
  BackendSheetResponse,
  fetchAutoRepairRecords,
  parseRepairRows,
} from './services/googleSheets';
import {
  EquipmentModality,
  NormalizedStatus,
  ParsedSheetResult,
  RepairRecord,
} from './types/repair';
import { SummaryStrip } from './components/SummaryStrip';
import { OrStatusBoard } from './components/OrStatusBoard';
import { RecordDetailDrawer } from './components/RecordDetailDrawer';

type ModalityFilter = 'all' | 'imaging_only' | EquipmentModality;
type StatusFilter = 'all' | NormalizedStatus;

export function App() {
  const [backendMeta, setBackendMeta] = useState<Omit<BackendSheetResponse, 'rows'> | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSheetResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // OR Monitor Controls
  const [now, setNow] = useState<Date>(() => new Date());
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(30);
  const [blinkEnabled, setBlinkEnabled] = useState<boolean>(true);
  const [isDark, setIsDark] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Inspection Drawer
  const [selectedRecord, setSelectedRecord] = useState<RepairRecord | null>(null);

  const isFetchingRef = useRef(false);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Live OR wall-clock tick every second
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadRepairBoard = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoadingData(true);
    setDataError(null);

    try {
      const payload = await fetchAutoRepairRecords();
      const { rows, ...meta } = payload;
      setBackendMeta(meta);

      if (payload.error) {
        setDataError(payload.error);
      }

      if (payload.configured && !payload.error) {
        const parsed = parseRepairRows(rows, new Date());
        setParsedData(parsed);
        setLastSyncedAt(new Date());
      } else if (!payload.configured) {
        setParsedData(null);
      }
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถเชื่อมต่อระบบหลังบ้านเพื่อดึงข้อมูล Google Sheets ได้'
      );
    } finally {
      setIsLoadingData(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Auto-connect immediately on mount
  useEffect(() => {
    void loadRepairBoard();
  }, [loadRepairBoard]);

  // Real-time auto-refresh polling
  useEffect(() => {
    if (autoRefreshSec <= 0) return;
    if (backendMeta && !backendMeta.configured) return;
    const interval = window.setInterval(() => {
      void loadRepairBoard();
    }, autoRefreshSec * 1000);
    return () => window.clearInterval(interval);
  }, [autoRefreshSec, backendMeta, loadRepairBoard]);

  const allRecords = parsedData?.records || [];

  const hasOtherEquipment = useMemo(
    () => allRecords.some((r) => r.modality === 'other'),
    [allRecords]
  );

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRecords.filter((rec) => {
      if (modalityFilter === 'imaging_only') {
        if (rec.modality !== 'fluoroscopy' && rec.modality !== 'ultrasound') {
          return false;
        }
      } else if (modalityFilter !== 'all' && rec.modality !== modalityFilter) {
        return false;
      }

      if (statusFilter !== 'all' && rec.normalizedStatus !== statusFilter) {
        return false;
      }

      if (q) {
        const haystack = [
          rec.hospital,
          rec.equipment,
          rec.product,
          rec.problem,
          rec.statusRaw,
          rec.irrsId || '',
          rec.serial || '',
          rec.engineer || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [allRecords, modalityFilter, statusFilter, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    modalityFilter !== 'all' ||
    statusFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setModalityFilter('all');
    setStatusFilter('all');
  };

  const formattedClock = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const formattedToday = now.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isUnconfigured = backendMeta && !backendMeta.configured;
  const activeTitle = backendMeta?.spreadsheetTitle || 'PM All';
  const activeTab = backendMeta?.sheetName || 'CM Record';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#080D16] dark:text-slate-100">
      {/* Clean Top Bar without OR Status Board / Google Sheet Source nav items */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#0B111E]/95 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            Innovative Imaging Systems
          </span>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="สลับโหมดสีหน้าจอ"
              className="px-3 py-2 min-h-[40px] inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4" />
                  <span className="hidden sm:inline">Daylight</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  <span className="hidden sm:inline">OR Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void loadRepairBoard()}
              disabled={isLoadingData}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`}
              />
              <span>อัปเดตทันที</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* OR Surgical Monitor Header Strip */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/90">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              กระดานสถานะงานซ่อม Fluoroscopy & Ultrasound
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <span>
                {activeTitle} / {activeTab}
              </span>
              {lastSyncedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    อัปเดตล่าสุด{' '}
                    {lastSyncedAt.toLocaleTimeString('th-TH', { hour12: false })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-6 pt-1 lg:pt-0">
            <div className="text-left lg:text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {formattedToday}
              </div>
              <div className="font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-sky-400">
                {formattedClock}
              </div>
            </div>
          </div>
        </section>

        {/* Server Auto-Connect Notice when Environment Variables are not yet set */}
        {isUnconfigured ? (
          <section className="border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0E1523] rounded-xl p-6 sm:p-8 max-w-2xl mx-auto my-6 space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                รอการตั้งค่า Environment Variables บน Server / Vercel
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ระบบถูกตั้งค่าให้เชื่อมต่อไฟล์ Google Sheet <strong>PM All</strong> แผ่นงาน{' '}
                <strong>CM Record</strong> อัตโนมัติโดยไม่ต้องล็อกอิน กรุณากำหนดค่าตัวแปรใน{' '}
                <strong>Vercel Project Settings → Environment Variables</strong> (หรือไฟล์{' '}
                <code className="font-mono">.env</code>):
              </p>
            </div>

            {dataError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-sm text-rose-700 dark:text-rose-300"
              >
                {dataError}
              </div>
            )}

            <div className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs space-y-1.5 overflow-x-auto">
              <div>GOOGLE_SPREADSHEET_ID=รหัสไฟล์จาก_URL_Google_Sheet</div>
              <div>GOOGLE_SHEET_NAME=CM Record</div>
              <div>GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com</div>
              <div>GOOGLE_PRIVATE_KEY=&quot;-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n&quot;</div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                * หากไฟล์เปิดแชร์แบบ &quot;ทุกคนที่มีลิงก์สามารถดูได้&quot; ใช้เฉพาะ GOOGLE_SPREADSHEET_ID ได้เลย
              </span>
              <button
                type="button"
                onClick={() => void loadRepairBoard()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-500 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                เชื่อมต่ออีกครั้ง
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* Error Banner if sheet fetch failed */}
            {dataError && (
              <div
                role="alert"
                className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <p className="text-sm text-rose-800 dark:text-rose-200">
                  {dataError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadRepairBoard()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-500 shrink-0"
                >
                  ลองเชื่อมต่อใหม่
                </button>
              </div>
            )}

            {/* 5-Column Summary Telemetry Strip */}
            <SummaryStrip records={filteredRecords} isLoading={isLoadingData} />

            {/* Workspace Toolbar: Filters, Search, Auto-Refresh, Blink Control */}
            <section
              aria-label="ตัวกรองและการควบคุมกระดานสถานะ"
              className="flex flex-col xl:flex-row xl:items-center justify-between gap-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                {/* Equipment Modality Segmented Control */}
                <div
                  role="group"
                  aria-label="กรองตามประเภทเครื่องมือ"
                  className="inline-flex items-center p-1 bg-slate-200/75 dark:bg-[#111A2B] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-w-full"
                >
                  <button
                    type="button"
                    onClick={() => setModalityFilter('all')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      modalityFilter === 'all'
                        ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ทั้งหมด ({allRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalityFilter('fluoroscopy')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      modalityFilter === 'fluoroscopy'
                        ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Fluoroscopy
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalityFilter('ultrasound')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      modalityFilter === 'ultrasound'
                        ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Ultrasound
                  </button>
                  {hasOtherEquipment && (
                    <button
                      type="button"
                      onClick={() => setModalityFilter('imaging_only')}
                      className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        modalityFilter === 'imaging_only'
                          ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      เฉพาะ Fluoro & US
                    </button>
                  )}
                </div>

                {/* Status Filter Dropdown */}
                <select
                  aria-label="กรองตามสถานะงานซ่อม"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1523] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">ทุกสถานะงานซ่อม</option>
                  <option value="new_urgent">แจ้งซ่อมใหม่ / ด่วน</option>
                  <option value="in_progress">กำลังดำเนินการ</option>
                  <option value="waiting_parts">รออะไหล่ / รอตรวจ</option>
                  <option value="completed">เสร็จสิ้นแล้ว</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1 sm:flex-initial sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาโรงพยาบาล, เครื่อง, อาการ..."
                    className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1523] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="ล้างคำค้นหา"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Blinking Text Toggle */}
                <button
                  type="button"
                  onClick={() => setBlinkEnabled((prev) => !prev)}
                  className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    blinkEnabled
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1523] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {blinkEnabled ? 'กระพริบสถานะ: เปิด' : 'กระพริบสถานะ: ปิด'}
                </button>

                {/* Auto Refresh Cadence */}
                <select
                  aria-label="ความถี่ในการอัปเดตอัตโนมัติ"
                  value={autoRefreshSec}
                  onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                  className="px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1523] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value={15}>รีเฟรชอัตโนมัติ 15 วิ</option>
                  <option value={30}>รีเฟรชอัตโนมัติ 30 วิ</option>
                  <option value={60}>รีเฟรชอัตโนมัติ 60 วิ</option>
                  <option value={0}>รีเฟรชด้วยตนเอง</option>
                </select>
              </div>
            </section>

            {/* Operating Room Status Board */}
            <section id="status-board" aria-label="ตารางสถานะงานซ่อมโรงพยาบาล">
              <OrStatusBoard
                records={filteredRecords}
                isLoading={isLoadingData}
                blinkEnabled={blinkEnabled}
                hasActiveFilters={hasActiveFilters}
                onResetFilters={resetFilters}
                onSelectRecord={setSelectedRecord}
                onRefresh={() => void loadRepairBoard()}
              />
            </section>
          </>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-5 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-500">
          <span>Innovative Imaging Systems · Fluoroscopy & Ultrasound Service Board</span>
          <span>
            เรียงลำดับจากวันที่แจ้งซ่อมล่าสุด · คำนวณระยะเวลาดำเนินการอ้างอิงวันปัจจุบัน
          </span>
        </div>
      </footer>

      {/* Inspection Slide-Over Drawer */}
      <RecordDetailDrawer
        record={selectedRecord}
        blinkEnabled={blinkEnabled}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

export default App;
