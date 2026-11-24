import React from 'react';
import { RepairRecord } from '../types/repair';

interface SummaryStripProps {
  records: RepairRecord[];
  isLoading: boolean;
}

export const SummaryStrip: React.FC<SummaryStripProps> = ({
  records,
  isLoading,
}) => {
  const total = records.length;
  const activeCount = records.filter(
    (r) => r.normalizedStatus === 'new_urgent' || r.normalizedStatus === 'in_progress'
  ).length;
  const waitingPartsCount = records.filter(
    (r) => r.normalizedStatus === 'waiting_parts'
  ).length;
  const completedCount = records.filter(
    (r) => r.normalizedStatus === 'completed'
  ).length;
  const fluoroCount = records.filter((r) => r.modality === 'fluoroscopy').length;
  const usCount = records.filter((r) => r.modality === 'ultrasound').length;

  const openRecordsWithDays = records.filter(
    (r) =>
      r.elapsedDays !== null &&
      r.normalizedStatus !== 'completed' &&
      r.normalizedStatus !== 'cancelled'
  );
  const avgOpenDays =
    openRecordsWithDays.length > 0
      ? Math.round(
          openRecordsWithDays.reduce((acc, r) => acc + (r.elapsedDays || 0), 0) /
            openRecordsWithDays.length
        )
      : 0;

  const metrics = [
    {
      label: 'งานซ่อมทั้งหมด',
      sublabel: 'Total CM Cases',
      value: total,
      accent: 'text-slate-900 dark:text-white',
    },
    {
      label: 'กำลังดำเนินการ / ด่วน',
      sublabel: 'In Procedure & Urgent',
      value: activeCount,
      accent: 'text-sky-600 dark:text-sky-400',
    },
    {
      label: 'รออะไหล่ / รอตรวจ',
      sublabel: 'Waiting Parts / Hold',
      value: waitingPartsCount,
      accent: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'เสร็จสิ้นแล้ว',
      sublabel: 'Completed Cases',
      value: completedCount,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'เฉลี่ยวันค้างดำเนินการ',
      sublabel: `Fluoro ${fluoroCount} · US ${usCount}`,
      value: `${avgOpenDays} วัน`,
      accent: avgOpenDays >= 7 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100',
    },
  ];

  return (
    <section
      aria-label="สรุปสถานะงานซ่อม"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0E1523] rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800/90 overflow-hidden"
    >
      {metrics.map((m, idx) => (
        <div
          key={m.label}
          className={`px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col justify-between gap-1 ${
            idx === 4 ? 'col-span-2 sm:col-span-1' : ''
          }`}
        >
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
            {m.label}
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse my-0.5" />
          ) : (
            <div className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${m.accent}`}>
              {m.value}
            </div>
          )}
          <div className="text-xs text-slate-500 dark:text-slate-500 font-mono tabular-nums truncate">
            {m.sublabel}
          </div>
        </div>
      ))}
    </section>
  );
};
