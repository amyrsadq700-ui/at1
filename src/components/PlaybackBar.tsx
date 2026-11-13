import { Pause, Play, RotateCcw, StepForward, Trash2 } from 'lucide-react';

interface PlaybackBarProps {
  isRunning: boolean;
  timeScale: number;
  simTimeSec: number;
  onToggleRun: () => void;
  onStepForward: () => void;
  onChangeTimeScale: (scale: number) => void;
  onClearObjects: () => void;
  onResetScenario: () => void;
}

const SPEED_OPTIONS = [
  { value: 0.25, label: '۰.۲۵×' },
  { value: 0.5, label: '۰.۵×' },
  { value: 1, label: '۱×' },
];

export function PlaybackBar({
  isRunning,
  timeScale,
  simTimeSec,
  onToggleRun,
  onStepForward,
  onChangeTimeScale,
  onClearObjects,
  onResetScenario,
}: PlaybackBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5">
      {/* Primary Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleRun}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-600 ${
            isRunning
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-sky-700 text-white hover:bg-sky-800'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4" aria-hidden="true" />
              <span>توقف</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>اجرا</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onStepForward}
          title="پیشروی یک گام زمانی (۱۶.۷ میلی‌ثانیه)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-600"
        >
          <StepForward className="h-4 w-4" aria-hidden="true" />
          <span>یک گام جلو</span>
        </button>

        {/* Speed Selector */}
        <div
          role="group"
          aria-label="سرعت زمان شبیه‌سازی"
          className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
        >
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangeTimeScale(opt.value)}
              aria-pressed={timeScale === opt.value}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                timeScale === opt.value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Simulation Clock & Reset Actions */}
      <div className="flex items-center gap-2">
        <div className="px-2 text-xs text-slate-600 whitespace-nowrap">
          <span>زمان شبیه‌سازی: </span>
          <span className="font-mono-num font-semibold text-slate-900">
            {simTimeSec.toFixed(2)} s
          </span>
        </div>

        <button
          type="button"
          onClick={onClearObjects}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 whitespace-nowrap shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>پاک‌سازی اجسام</span>
        </button>

        <button
          type="button"
          onClick={onResetScenario}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>بازنشانی آزمایش</span>
        </button>
      </div>
    </div>
  );
}
