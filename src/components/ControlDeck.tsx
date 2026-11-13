import { Anchor, ArrowDownToLine, Plus, Scale, Trash2 } from 'lucide-react';
import {
  FLUID_PRESETS,
  MATERIAL_PRESETS,
  type BodyTelemetry,
  type FluidId,
  type MaterialId,
  type ShapeKind,
  type SimulationConfig,
  type SimulationStats,
} from '../physics/types';

interface ControlDeckProps {
  config: SimulationConfig;
  stats: SimulationStats;
  selectedBody: BodyTelemetry | null;
  spawnMaterial: MaterialId;
  onChangeSpawnMaterial: (id: MaterialId) => void;
  onQuickSpawn: (shape: ShapeKind) => void;
  onUpdateConfig: (patch: Partial<SimulationConfig>) => void;
  onSelectFluid: (id: FluidId) => void;
  onUpdateBodyMaterial: (bodyId: number, materialId: MaterialId) => void;
  onUpdateBodyDensity: (bodyId: number, density: number) => void;
  onUpdateBodyMass: (bodyId: number, mass: number) => void;
  onUpdateBodyScale: (bodyId: number, scale: number) => void;
  onUpdateBodyRestitution: (bodyId: number, restitution: number) => void;
  onUpdateBodyFriction: (bodyId: number, friction: number) => void;
  onUpdateBodyAngle: (bodyId: number, angleDeg: number) => void;
  onToggleBodyStatic: (bodyId: number) => void;
  onDropBodyFromTop: (bodyId: number) => void;
  onAttachScale: (bodyId: number) => void;
  onDeleteBody: (bodyId: number) => void;
  isScaleAttachedToSelected: boolean;
}

const FLUID_ORDER: FluidId[] = [
  'water',
  'oil',
  'saltwater',
  'glycerin',
  'mercury',
];

const MATERIAL_ORDER: MaterialId[] = [
  'wood',
  'ice',
  'rubber',
  'brick',
  'aluminum',
  'steel',
  'gold',
];

const GRAVITY_PRESETS = [
  { label: 'بی‌وزنی', value: 0 },
  { label: 'ماه', value: 1.62 },
  { label: 'مریخ', value: 3.71 },
  { label: 'زمین', value: 9.81 },
  { label: 'مشتری', value: 24.79 },
];

export function ControlDeck({
  config,
  stats,
  selectedBody,
  spawnMaterial,
  onChangeSpawnMaterial,
  onQuickSpawn,
  onUpdateConfig,
  onSelectFluid,
  onUpdateBodyMaterial,
  onUpdateBodyDensity,
  onUpdateBodyMass,
  onUpdateBodyScale,
  onUpdateBodyRestitution,
  onUpdateBodyFriction,
  onUpdateBodyAngle,
  onToggleBodyStatic,
  onDropBodyFromTop,
  onAttachScale,
  onDeleteBody,
  isScaleAttachedToSelected,
}: ControlDeckProps) {
  return (
    <aside
      aria-label="پنل کنترل و داده‌های فیزیکی"
      className="flex h-full flex-col overflow-y-auto border-r border-slate-200 bg-white"
    >
      {/* Section 1: Live Physics Readout (Always visible at top) */}
      <section className="border-b border-slate-200 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            داده‌های لحظه‌ای
          </h2>
          {selectedBody && (
            <span className="truncate text-xs font-medium text-sky-700">
              {selectedBody.labelFa} · {selectedBody.stateFa}
            </span>
          )}
        </div>

        {selectedBody ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <ReadoutRow
              label="نیروی وزن (Fg)"
              value={`${selectedBody.gravityForceN.toFixed(1)} N`}
              tone="red"
            />
            <ReadoutRow
              label="نیروی شناوری (Fb)"
              value={`${selectedBody.buoyancyForceN.toFixed(1)} N`}
              tone="emerald"
            />
            <ReadoutRow
              label="برآیند نیرو (Fnet)"
              value={`${selectedBody.netForceMagN.toFixed(1)} N`}
            />
            <ReadoutRow
              label="تندی (v)"
              value={`${selectedBody.speedMs.toFixed(2)} m/s`}
              tone="sky"
            />
            <ReadoutRow
              label="حجم غوطه‌ور"
              value={`${selectedBody.submergedVolumeLiters.toFixed(1)} / ${selectedBody.volumeLiters.toFixed(1)} L`}
            />
            <ReadoutRow
              label="درصد غوطه‌وری"
              value={`${Math.round(selectedBody.submergedFraction * 100)}%`}
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            برای مشاهده نیروها و بردارهای دقیق، روی یکی از اجسام داخل مخزن کلیک کنید یا جسم جدیدی بسازید.
          </p>
        )}

        {/* Tank displacement summary */}
        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-600">
          <span>
            سطح سیال:{' '}
            <strong dir="ltr" className="inline-block font-mono-num text-slate-900">
              {stats.waterLevelM.toFixed(2)} m
            </strong>
          </span>
          <span>
            جابه‌جایی:{' '}
            <strong dir="ltr" className="inline-block font-mono-num text-sky-700">
              +{stats.displacedVolumeLiters.toFixed(1)} L
            </strong>
          </span>
        </div>
      </section>

      {/* Section 2: Selected Object Properties & Quick Spawn */}
      <section className="border-b border-slate-200 px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            {selectedBody ? 'ویژگی‌های جسم انتخاب‌شده' : 'افزودن جسم به مخزن'}
          </h2>
          {selectedBody && (
            <div className="flex items-center gap-1">
              {!selectedBody.isStatic && (
                <>
                  <button
                    type="button"
                    onClick={() => onAttachScale(selectedBody.id)}
                    title="اتصال یا جداسازی از نیروسنج"
                    aria-label="اتصال به نیروسنج"
                    className={`rounded-md p-1.5 transition-colors ${
                      isScaleAttachedToSelected
                        ? 'bg-sky-100 text-sky-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Scale className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDropBodyFromTop(selectedBody.id)}
                    title="رهایش از بالای مخزن"
                    aria-label="رهایش از بالای مخزن"
                    className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onToggleBodyStatic(selectedBody.id)}
                title={selectedBody.isStatic ? 'آزادسازی جسم' : 'ثابت کردن در فضا'}
                aria-label={selectedBody.isStatic ? 'آزادسازی جسم' : 'ثابت کردن جسم'}
                className={`rounded-md p-1.5 transition-colors ${
                  selectedBody.isStatic
                    ? 'bg-amber-100 text-amber-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Anchor className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteBody(selectedBody.id)}
                title="حذف جسم"
                aria-label="حذف جسم"
                className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Material Selector (applies to selected body OR sets default spawn material) */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">
              {selectedBody ? 'جنس جسم انتخاب‌شده' : 'جنس پیش‌فرض ساخت'}
            </span>
            <span className="text-slate-500">
              {
                MATERIAL_PRESETS[
                  selectedBody ? selectedBody.materialId : spawnMaterial
                ].nameFa
              }
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MATERIAL_ORDER.map((matId) => {
              const mat = MATERIAL_PRESETS[matId];
              const isActive =
                (selectedBody ? selectedBody.materialId : spawnMaterial) === matId;
              return (
                <button
                  key={matId}
                  type="button"
                  onClick={() => {
                    onChangeSpawnMaterial(matId);
                    if (selectedBody) {
                      onUpdateBodyMaterial(selectedBody.id, matId);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-sky-600 bg-sky-50 text-sky-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-xs border border-black/15"
                    style={{ backgroundColor: mat.fillColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{mat.nameFa}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Spawn Buttons */}
        <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-600">ساخت سریع:</span>
          <button
            type="button"
            onClick={() => onQuickSpawn('box')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>مکعب</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickSpawn('circle')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>کره</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickSpawn('polygon')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>چندضلعی</span>
          </button>
        </div>

        {/* Selected Body Fine Sliders */}
        {selectedBody && (
          <div className="space-y-3">
            <SliderField
              id="body-density"
              label="چگالی جسم"
              value={selectedBody.density}
              min={200}
              max={19500}
              step={50}
              displayValue={`${Math.round(selectedBody.density)} kg/m³`}
              onChange={(val) => onUpdateBodyDensity(selectedBody.id, val)}
            />

            {!selectedBody.isStatic && (
              <SliderField
                id="body-mass"
                label="جرم"
                value={selectedBody.mass}
                min={1}
                max={400}
                step={0.5}
                displayValue={`${selectedBody.mass.toFixed(1)} kg`}
                onChange={(val) => onUpdateBodyMass(selectedBody.id, val)}
              />
            )}

            <SliderField
              id="body-scale"
              label="اندازه (مقیاس)"
              value={selectedBody.scale}
              min={0.6}
              max={1.8}
              step={0.05}
              displayValue={`${selectedBody.scale.toFixed(2)}×`}
              onChange={(val) => onUpdateBodyScale(selectedBody.id, val)}
            />

            <div className="grid grid-cols-2 gap-3">
              <SliderField
                id="body-restitution"
                label="کشسانی (e)"
                value={selectedBody.restitution}
                min={0}
                max={1}
                step={0.02}
                displayValue={selectedBody.restitution.toFixed(2)}
                onChange={(val) => onUpdateBodyRestitution(selectedBody.id, val)}
              />
              <SliderField
                id="body-friction"
                label="اصطکاک (μ)"
                value={selectedBody.friction}
                min={0}
                max={1}
                step={0.02}
                displayValue={selectedBody.friction.toFixed(2)}
                onChange={(val) => onUpdateBodyFriction(selectedBody.id, val)}
              />
            </div>

            {selectedBody.shape === 'ramp' && (
              <SliderField
                id="body-angle"
                label="زاویه چرخش"
                value={selectedBody.angleDeg}
                min={-60}
                max={60}
                step={1}
                displayValue={`${Math.round(selectedBody.angleDeg)}°`}
                onChange={(val) => onUpdateBodyAngle(selectedBody.id, val)}
              />
            )}
          </div>
        )}
      </section>

      {/* Section 3: Global Environment & Fluid Controls */}
      <section className="px-4 py-3">
        <h2 className="mb-2.5 text-sm font-bold text-slate-900">
          محیط و دینامیک سیال
        </h2>

        <div className="space-y-2.5">
          {/* Gravity */}
          <div>
            <SliderField
              id="env-gravity"
              label="شتاب گرانش (g)"
              value={config.gravity}
              min={0}
              max={25}
              step={0.1}
              displayValue={`${config.gravity.toFixed(2)} m/s²`}
              onChange={(val) => onUpdateConfig({ gravity: val })}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {GRAVITY_PRESETS.map((gp) => (
                <button
                  key={gp.label}
                  type="button"
                  onClick={() => onUpdateConfig({ gravity: gp.value })}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    Math.abs(config.gravity - gp.value) < 0.05
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {gp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fluid Selector */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              نوع سیال مخزن
            </span>
            <div className="flex flex-wrap gap-1">
              {FLUID_ORDER.map((fid) => {
                const f = FLUID_PRESETS[fid];
                const active = config.fluidId === fid;
                return (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => onSelectFluid(fid)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'border-sky-600 bg-sky-50 text-sky-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {f.nameFa}
                  </button>
                );
              })}
            </div>
          </div>

          <SliderField
            id="env-fluid-density"
            label="چگالی سیال (ρ)"
            value={config.fluidDensity}
            min={500}
            max={13600}
            step={25}
            displayValue={`${Math.round(config.fluidDensity)} kg/m³`}
            onChange={(val) =>
              onUpdateConfig({ fluidId: 'custom', fluidDensity: val })
            }
          />

          <SliderField
            id="env-water-level"
            label="ارتفاع پایه سیال"
            value={Math.round(config.baseWaterFraction * 100)}
            min={0}
            max={80}
            step={1}
            displayValue={`${Math.round(config.baseWaterFraction * 100)}%`}
            onChange={(val) =>
              onUpdateConfig({ baseWaterFraction: val / 100 })
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <SliderField
              id="env-fluid-visc"
              label="مقاومت سیال"
              value={config.fluidViscosity}
              min={0.2}
              max={6}
              step={0.1}
              displayValue={`${config.fluidViscosity.toFixed(1)}×`}
              onChange={(val) => onUpdateConfig({ fluidViscosity: val })}
            />
            <SliderField
              id="env-air-drag"
              label="مقاومت هوا"
              value={config.airResistance}
              min={0}
              max={0.08}
              step={0.002}
              displayValue={config.airResistance.toFixed(3)}
              onChange={(val) => onUpdateConfig({ airResistance: val })}
            />
          </div>
        </div>
      </section>
    </aside>
  );
}

interface ReadoutRowProps {
  label: string;
  value: string;
  tone?: 'red' | 'emerald' | 'sky';
}

function ReadoutRow({ label, value, tone }: ReadoutRowProps) {
  const valueColor =
    tone === 'red'
      ? 'text-red-700'
      : tone === 'emerald'
        ? 'text-emerald-700'
        : tone === 'sky'
          ? 'text-sky-700'
          : 'text-slate-900';

  return (
    <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1">
      <span className="truncate text-slate-600">{label}</span>
      <span
        className={`font-mono-num font-semibold whitespace-nowrap shrink-0 ${valueColor}`}
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (val: number) => void;
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: SliderFieldProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-slate-700">
          {label}
        </label>
        <span className="font-mono-num font-semibold text-slate-900" dir="ltr">
          {displayValue}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="sci-slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
