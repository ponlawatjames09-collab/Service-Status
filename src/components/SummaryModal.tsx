import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { RepairRecord } from '../types/repair';
import { SummaryStrip } from './SummaryStrip';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RepairRecord[];
  isLoading: boolean;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  onClose,
  records,
  isLoading,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const statusCounts = records.reduce<Record<string, number>>((acc, rec) => {
    const label = rec.statusRaw || 'ไม่ระบุสถานะ';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const sortedStatusEntries = Object.entries(statusCounts).sort(
    (a, b) => b[1] - a[1]
  );

  const openFluoro = records.filter(
    (r) =>
      r.modality === 'fluoroscopy' &&
      r.normalizedStatus !== 'completed' &&
      r.normalizedStatus !== 'cancelled'
  ).length;

  const openUs = records.filter(
    (r) =>
      r.modality === 'ultrasound' &&
      r.normalizedStatus !== 'completed' &&
      r.normalizedStatus !== 'cancelled'
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="summary-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              สรุปสถานะงานซ่อมทั้งหมด (CM Record)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              งานค้างดำเนินการปัจจุบัน: Fluoroscopy {openFluoro} เครื่อง · Ultrasound {openUs} เครื่อง
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างสรุปงานซ่อม"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          <SummaryStrip records={records} isLoading={isLoading} />

          {sortedStatusEntries.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-[#0E1523] border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                จำนวนงานแยกตามสถานะในตาราง CM Record
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {sortedStatusEntries.map(([statusLabel, count]) => (
                  <div
                    key={statusLabel}
                    className="px-4 py-2.5 flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {statusLabel}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-sky-400">
                      {count} งาน
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
