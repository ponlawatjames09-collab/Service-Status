import React, { useEffect } from 'react';
import { X, Calendar, Clock, Building2, Activity, Wrench } from 'lucide-react';
import { RepairRecord } from '../types/repair';
import { StatusBadge } from './StatusBadge';

interface RecordDetailDrawerProps {
  record: RepairRecord | null;
  blinkEnabled: boolean;
  onClose: () => void;
}

export const RecordDetailDrawer: React.FC<RecordDetailDrawerProps> = ({
  record,
  blinkEnabled,
  onClose,
}) => {
  useEffect(() => {
    if (!record) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [record, onClose]);

  if (!record) return null;

  const extraEntries = Object.entries(record.extraFields);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-hospital-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0E1523] border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 flex flex-col gap-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {record.irrsId ? `Case ${record.irrsId}` : `Row #${record.rowIndex}`}
            </div>
            <h2
              id="drawer-hospital-title"
              className="mt-1 text-xl font-bold text-slate-900 dark:text-white leading-snug"
            >
              {record.hospital}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างรายละเอียด"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge
            status={record.normalizedStatus}
            rawLabel={record.statusRaw}
            blinkEnabled={blinkEnabled}
          />
          {record.elapsedDays !== null && (
            <div className="inline-flex items-center gap-2 text-sm font-mono tabular-nums text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                ดำเนินการผ่านมาแล้ว{' '}
                <strong className="text-slate-900 dark:text-white">
                  {record.elapsedDays}
                </strong>{' '}
                วัน
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-200 dark:border-slate-800 text-sm">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              วันที่แจ้งงานซ่อม (Report Date)
            </div>
            <div className="mt-1 font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
              {record.reportDate
                ? record.reportDate.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : record.reportDateRaw || '-'}
            </div>
            {record.reportDateRaw && (
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                ค่าต้นฉบับ: {record.reportDateRaw}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              เครื่องมือแพทย์ (Equipment)
            </div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-white">
              {record.equipment}
            </div>
            <div className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">
              {record.modality === 'fluoroscopy'
                ? 'Fluoroscopy'
                : record.modality === 'ultrasound'
                ? 'Ultrasound'
                : record.product || 'Medical Equipment'}
            </div>
          </div>

          {record.engineer && (
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                วิศวกรผู้รับผิดชอบ
              </div>
              <div className="mt-1 font-medium text-slate-900 dark:text-white">
                {record.engineer}
              </div>
            </div>
          )}

          {record.serial && (
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Serial Number
              </div>
              <div className="mt-1 font-mono tabular-nums text-slate-900 dark:text-white">
                {record.serial}
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            อาการเสีย / รายละเอียดปัญหา (Problem)
          </h3>
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {record.problem}
          </p>
        </div>

        {extraEntries.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
              ข้อมูลทั้งหมดจากแผ่นงาน CM Record
            </h3>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {extraEntries.map(([key, value]) => {
                const isSafeUrl = /^https:\/\//i.test(value.trim());
                return (
                  <div
                    key={key}
                    className="py-2 flex items-start justify-between gap-4"
                  >
                    <dt className="text-slate-500 dark:text-slate-400 shrink-0 max-w-[40%]">
                      {key}
                    </dt>
                    <dd className="text-right text-slate-900 dark:text-slate-200 font-medium break-words">
                      {isSafeUrl ? (
                        <a
                          href={value.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 dark:text-sky-400 underline underline-offset-2 hover:opacity-80"
                        >
                          เปิดลิงก์ / รูปภาพประกอบ
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};
