import {
  ArrowUpRight,
  Box,
  Circle,
  Droplets,
  Grid3x3,
  Hexagon,
  Layers,
  MousePointer2,
  MoveUp,
  Ruler,
  Scale,
  Square,
  Timer,
  Triangle,
} from 'lucide-react';
import type { InteractionTool, SimulationConfig } from '../physics/types';

export type ViewportMode = '2d' | '3d';

interface CanvasToolbarProps {
  viewMode: ViewportMode;
  onChangeViewMode: (mode: ViewportMode) => void;
  activeTool: InteractionTool;
  onSelectTool: (tool: InteractionTool) => void;
  config: SimulationConfig;
  onToggleConfig: (
    key:
      | 'showForceVectors'
      | 'showVelocityVector'
      | 'showGrid'
      | 'showRuler'
      | 'showScale'
      | 'showStopwatch'
  ) => void;
}

const TOOLS: {
  id: InteractionTool;
  label: string;
  Icon: typeof MousePointer2;
}[] = [
  { id: 'select', label: 'انتخاب', Icon: MousePointer2 },
  { id: 'spawn-box', label: 'مکعب', Icon: Square },
  { id: 'spawn-circle', label: 'کره', Icon: Circle },
  { id: 'spawn-polygon', label: 'چندضلعی', Icon: Hexagon },
  { id: 'spawn-ramp', label: 'سطح شیب‌دار', Icon: Triangle },
  { id: 'pour-water', label: 'ریختن آب', Icon: Droplets },
];

export function CanvasToolbar({
  viewMode,
  onChangeViewMode,
  activeTool,
  onSelectTool,
  config,
  onToggleConfig,
}: CanvasToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* 2D / 3D Rendering Mode Switch */}
        <div
          role="group"
          aria-label="حالت نمایش آزمایشگاه"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('2d')}
            aria-pressed={viewMode === '2d'}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-600 ${
              viewMode === '2d'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>دوبعدی (2D)</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('3d')}
            aria-pressed={viewMode === '3d'}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-600 ${
              viewMode === '3d'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Box className="h-3.5 w-3.5" aria-hidden="true" />
            <span>سه‌بعدی واقعی (3D)</span>
          </button>
        </div>

        {/* Creation & Interaction Tools */}
        <div
          role="toolbar"
          aria-label="ابزارهای تعامل و ساخت جسم"
          className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
        >
        {TOOLS.map(({ id, label, Icon }) => {
          const active = activeTool === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTool(id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-600 ${
                active
                  ? 'bg-sky-700 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
        </div>
      </div>

      {/* Vector Overlays & Measurement Instruments */}
      <div
        role="toolbar"
        aria-label="بردارها و ابزارهای اندازه‌گیری"
        className="flex flex-wrap items-center gap-1.5"
      >
        <ToggleButton
          active={config.showForceVectors}
          onClick={() => onToggleConfig('showForceVectors')}
          label="بردار نیرو"
          Icon={MoveUp}
          activeTone="emerald"
        />
        <ToggleButton
          active={config.showVelocityVector}
          onClick={() => onToggleConfig('showVelocityVector')}
          label="بردار سرعت"
          Icon={ArrowUpRight}
          activeTone="sky"
        />
        <ToggleButton
          active={config.showGrid}
          onClick={() => onToggleConfig('showGrid')}
          label="شبکه"
          Icon={Grid3x3}
          activeTone="slate"
        />
        <span className="mx-0.5 h-5 w-px bg-slate-300" aria-hidden="true" />
        <ToggleButton
          active={config.showRuler}
          onClick={() => onToggleConfig('showRuler')}
          label="خط‌کش"
          Icon={Ruler}
          activeTone="amber"
        />
        <ToggleButton
          active={config.showScale}
          onClick={() => onToggleConfig('showScale')}
          label="نیروسنج"
          Icon={Scale}
          activeTone="sky"
        />
        <ToggleButton
          active={config.showStopwatch}
          onClick={() => onToggleConfig('showStopwatch')}
          label="کرنومتر"
          Icon={Timer}
          activeTone="slate"
        />
      </div>
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: typeof Grid3x3;
  activeTone: 'sky' | 'emerald' | 'amber' | 'slate';
}

function ToggleButton({
  active,
  onClick,
  label,
  Icon,
  activeTone,
}: ToggleButtonProps) {
  const toneClasses =
    activeTone === 'emerald'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : activeTone === 'amber'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : activeTone === 'sky'
          ? 'border-sky-300 bg-sky-50 text-sky-800'
          : 'border-slate-400 bg-slate-200/80 text-slate-900';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-600 ${
        active
          ? toneClasses
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
