import { BookOpen } from 'lucide-react';
import { SCENARIOS } from '../physics/scenarios';
import type { ScenarioId } from '../physics/types';

interface TopBarProps {
  activeScenario: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  onOpenFormulas: () => void;
}

const SCENARIO_ORDER: ScenarioId[] = [
  'buoyancy',
  'ramp',
  'collisions',
  'sandbox',
];

export function TopBar({
  activeScenario,
  onSelectScenario,
  onOpenFormulas,
}: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-200 bg-white px-5 py-3">
      {/* Zone 1: Single-line Brand Title */}
      <h1 className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
        آزمایشگاه فیزیک و سیالات
      </h1>

      {/* Zone 2: Scenario Navigation Tabs */}
      <nav
        aria-label="سناریوهای آزمایشگاه"
        className="flex items-center gap-1 overflow-x-auto"
      >
        {SCENARIO_ORDER.map((id) => {
          const s = SCENARIOS[id];
          const isActive = activeScenario === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectScenario(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                isActive
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {s.titleFa}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenFormulas}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>روابط فیزیکی</span>
        </button>
      </div>
    </header>
  );
}
