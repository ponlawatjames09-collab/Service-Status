import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
} from 'lucide-react';
import { NormalizedStatus } from '../types/repair';

interface StatusBadgeProps {
  status: NormalizedStatus;
  rawLabel: string;
  blinkEnabled?: boolean;
  compact?: boolean;
}

const STATUS_STYLES: Record<
  NormalizedStatus,
  {
    container: string;
    text: string;
    code: string;
    shouldBlink: boolean;
    urgentBlink?: boolean;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  new_urgent: {
    container:
      'bg-rose-500/12 border-rose-500/40 dark:bg-rose-500/15 dark:border-rose-500/45',
    text: 'text-rose-700 dark:text-rose-300',
    code: 'STAT',
    shouldBlink: true,
    urgentBlink: true,
    Icon: AlertTriangle,
  },
  in_progress: {
    container:
      'bg-sky-500/12 border-sky-500/40 dark:bg-sky-500/15 dark:border-sky-400/45',
    text: 'text-sky-700 dark:text-sky-300',
    code: 'PROC',
    shouldBlink: true,
    Icon: Wrench,
  },
  waiting_parts: {
    container:
      'bg-amber-500/12 border-amber-500/40 dark:bg-amber-500/15 dark:border-amber-400/45',
    text: 'text-amber-800 dark:text-amber-300',
    code: 'WAIT',
    shouldBlink: true,
    Icon: Clock,
  },
  completed: {
    container:
      'bg-emerald-500/12 border-emerald-500/35 dark:bg-emerald-500/15 dark:border-emerald-500/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    code: 'DONE',
    shouldBlink: false,
    Icon: CheckCircle2,
  },
  cancelled: {
    container:
      'bg-slate-500/10 border-slate-400/30 dark:bg-slate-700/30 dark:border-slate-600/50',
    text: 'text-slate-600 dark:text-slate-400',
    code: 'VOID',
    shouldBlink: false,
    Icon: XCircle,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  rawLabel,
  blinkEnabled = true,
  compact = false,
}) => {
  const cfg = STATUS_STYLES[status];
  const Icon = cfg.Icon;
  const blinkClass =
    blinkEnabled && cfg.shouldBlink
      ? cfg.urgentBlink
        ? 'animate-status-blink-urgent'
        : 'animate-status-blink'
      : '';

  return (
    <div
      className={`inline-flex items-center gap-2 border rounded-md ${
        compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
      } ${cfg.container}`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${cfg.text} ${blinkClass}`} />
      <span
        className={`font-semibold tracking-tight whitespace-nowrap ${
          compact ? 'text-xs' : 'text-sm'
        } ${cfg.text} ${blinkClass}`}
      >
        {rawLabel}
      </span>
    </div>
  );
};
