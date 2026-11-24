import React from 'react';
import { ChevronRight, RefreshCw, RotateCcw } from 'lucide-react';
import { EquipmentModality, RepairRecord } from '../types/repair';
import { StatusBadge } from './StatusBadge';

interface OrStatusBoardProps {
  records: RepairRecord[];
  isLoading: boolean;
  blinkEnabled: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onSelectRecord: (record: RepairRecord) => void;
  onRefresh: () => void;
}

const MODALITY_LABELS: Record<EquipmentModality, string> = {
  fluoroscopy: 'Fluoroscopy',
  ultrasound: 'Ultrasound',
  other: 'Medical Imaging',
};

function formatDisplayDate(record: RepairRecord): string {
  if (!record.reportDate) {
    return record.reportDateRaw || 'ไม่ระบุวันที่';
  }
  const d = record.reportDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getElapsedBadgeStyle(record: RepairRecord): {
  label: string;
  className: string;
} {
  if (record.elapsedDays === null) {
    return {
      label: '-',
      className: 'text-slate-400 dark:text-slate-500',
    };
  }

  const days = record.elapsedDays;
  const isDone =
    record.normalizedStatus === 'completed' ||
    record.normalizedStatus === 'cancelled';

  const label = days === 0 ? 'วันนี้ (0 วัน)' : days < 0 ? `ล่วงหน้า ${Math.abs(days)} วัน` : `${days} วัน`;

  if (isDone) {
    return {
      label,
      className: 'text-emerald-700 dark:text-emerald-400/90',
    };
  }

  if (days >= 14) {
    return {
      label,
      className: 'text-rose-600 dark:text-rose-400 font-bold',
    };
  }

  if (days >= 7) {
    return {
      label,
      className: 'text-amber-700 dark:text-amber-400 font-semibold',
    };
  }

  return {
    label,
    className: 'text-slate-700 dark:text-slate-200 font-medium',
  };
}

export const OrStatusBoard: React.FC<OrStatusBoardProps> = ({
  records,
  isLoading,
  blinkEnabled,
  hasActiveFilters,
  onResetFilters,
  onSelectRecord,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0E1523] rounded-lg overflow-hidden">
        <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 animate-pulse"
            >
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 flex-1 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0E1523] rounded-lg px-6 py-16 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {hasActiveFilters
              ? 'ไม่พบรายการงานซ่อมที่ตรงกับตัวกรอง'
              : 'ยังไม่มีข้อมูลงานซ่อมในแผ่นงานนี้'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {hasActiveFilters
              ? 'ลองปรับคำค้นหา ประเภทเครื่อง หรือตัวกรองสถานะ เพื่อดูรายการทั้งหมด'
              : 'ตรวจสอบว่า Google Sheet "PM All" แผ่นงาน "CM Record" มีข้อมูลและหัวข้อคอลัมน์ครบถ้วน'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-90 transition-opacity"
              >
                <RotateCcw className="w-4 h-4" />
                ล้างตัวกรองทั้งหมด
              </button>
            ) : (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                อัปเดตข้อมูลอีกครั้ง
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Operating Room Surgical Board Table (lg+) */}
      <div className="hidden lg:block border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0E1523] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0B111E] text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th scope="col" className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                  วันที่แจ้งซ่อม (Report Date)
                </th>
                <th scope="col" className="py-3.5 px-3 whitespace-nowrap text-right">
                  ดำเนินการผ่านมา
                </th>
                <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                  โรงพยาบาล (Hospital)
                </th>
                <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                  เครื่องมือแพทย์ (Equipment)
                </th>
                <th scope="col" className="py-3.5 px-4">
                  อาการเสีย (Problem)
                </th>
                <th scope="col" className="py-3.5 pl-4 pr-5 whitespace-nowrap text-right">
                  สถานะงานซ่อม (Status)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/75 text-sm">
              {records.map((rec) => {
                const elapsed = getElapsedBadgeStyle(rec);
                return (
                  <tr
                    key={rec.id}
                    onClick={() => onSelectRecord(rec)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectRecord(rec);
                      }
                    }}
                    className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-[#141E30] focus-visible:outline-none focus-visible:bg-sky-500/10 transition-colors"
                  >
                    <td className="py-3.5 pl-5 pr-3 align-top whitespace-nowrap">
                      <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatDisplayDate(rec)}
                      </div>
                      {rec.irrsId && (
                        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-500 mt-0.5">
                          {rec.irrsId}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 align-top whitespace-nowrap text-right">
                      <span
                        className={`font-mono tabular-nums text-sm ${elapsed.className}`}
                      >
                        {elapsed.label}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 align-top max-w-[260px]">
                      <div className="font-semibold text-slate-900 dark:text-white leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {rec.hospital}
                      </div>
                      {rec.engineer && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          ช่าง: {rec.engineer}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top max-w-[220px]">
                      <div className="font-medium text-slate-800 dark:text-slate-200 leading-snug">
                        {rec.equipment}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span
                          className={
                            rec.modality === 'fluoroscopy'
                              ? 'text-sky-700 dark:text-sky-400 font-medium'
                              : rec.modality === 'ultrasound'
                              ? 'text-teal-700 dark:text-teal-400 font-medium'
                              : ''
                          }
                        >
                          {MODALITY_LABELS[rec.modality]}
                        </span>
                        {rec.serial && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums truncate">
                              S/N {rec.serial}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top max-w-[340px]">
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">
                        {rec.problem}
                      </p>
                    </td>

                    <td className="py-3.5 pl-4 pr-5 align-top whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <StatusBadge
                          status={rec.normalizedStatus}
                          rawLabel={rec.statusRaw}
                          blinkEnabled={blinkEnabled}
                        />
                        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile & Tablet Hospital List View (< lg) */}
      <div className="lg:hidden space-y-3">
        {records.map((rec) => {
          const elapsed = getElapsedBadgeStyle(rec);
          return (
            <button
              key={rec.id}
              type="button"
              onClick={() => onSelectRecord(rec)}
              className="w-full text-left border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0E1523] hover:bg-slate-50 dark:hover:bg-[#141E30] rounded-lg p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>{formatDisplayDate(rec)}</span>
                    <span aria-hidden="true">·</span>
                    <span className={elapsed.className}>ผ่านมา {elapsed.label}</span>
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white leading-snug">
                    {rec.hospital}
                  </h3>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {rec.equipment}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span
                  className={`text-xs font-medium ${
                    rec.modality === 'fluoroscopy'
                      ? 'text-sky-700 dark:text-sky-400'
                      : rec.modality === 'ultrasound'
                      ? 'text-teal-700 dark:text-teal-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {MODALITY_LABELS[rec.modality]}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                {rec.problem}
              </p>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                <StatusBadge
                  status={rec.normalizedStatus}
                  rawLabel={rec.statusRaw}
                  blinkEnabled={blinkEnabled}
                  compact
                />
                {rec.engineer && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    ช่าง: {rec.engineer}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
};
