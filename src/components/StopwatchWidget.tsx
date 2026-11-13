import { Pause, Play, RotateCcw } from 'lucide-react';

interface StopwatchWidgetProps {
  elapsedSec: number;
  isStopwatchRunning: boolean;
  onToggleStopwatch: () => void;
  onResetStopwatch: () => void;
}

export function StopwatchWidget({
  elapsedSec,
  isStopwatchRunning,
  onToggleStopwatch,
  onResetStopwatch,
}: StopwatchWidgetProps) {
  const mins = Math.floor(elapsedSec / 60);
  const secs = Math.floor(elapsedSec % 60);
  const hundredths = Math.floor((elapsedSec * 100) % 100);
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(hundredths).padStart(2, '0')}`;

  return (
    <div
      aria-label="کرنومتر اندازه‌گیری زمان"
      className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-white/95 px-3 py-2 shadow-sm"
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-medium text-slate-500">کرنومتر</span>
        <span
          dir="ltr"
          className="font-mono-num text-base font-semibold text-slate-900"
        >
          {formatted}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleStopwatch}
          aria-label={isStopwatchRunning ? 'توقف کرنومتر' : 'شروع کرنومتر'}
          className={`rounded-md p-1.5 transition-colors ${
            isStopwatchRunning
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-sky-100 text-sky-800 hover:bg-sky-200'
          }`}
        >
          {isStopwatchRunning ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onResetStopwatch}
          aria-label="صفر کردن کرنومتر"
          className="rounded-md bg-slate-100 p-1.5 text-slate-700 transition-colors hover:bg-slate-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
