export type ShapeKind = 'box' | 'circle' | 'polygon' | 'ramp';

export type MaterialId =
  | 'wood'
  | 'ice'
  | 'rubber'
  | 'brick'
  | 'aluminum'
  | 'steel'
  | 'gold'
  | 'custom';

export type FluidId =
  | 'water'
  | 'oil'
  | 'ethanol'
  | 'saltwater'
  | 'glycerin'
  | 'mercury'
  | 'custom';

export type ScenarioId = 'buoyancy' | 'ramp' | 'collisions' | 'sandbox';

export type InteractionTool =
  | 'select'
  | 'spawn-box'
  | 'spawn-circle'
  | 'spawn-polygon'
  | 'spawn-ramp'
  | 'pour-water';

export interface MaterialPreset {
  id: MaterialId;
  nameFa: string;
  density: number; // kg/m³
  restitution: number; // 0..1
  friction: number; // 0..1
  fillColor: string;
  strokeColor: string;
  accentColor: string;
}

export interface FluidPreset {
  id: FluidId;
  nameFa: string;
  density: number; // kg/m³
  viscosityMultiplier: number; // relative drag coefficient multiplier
  surfaceColor: string;
  bodyTopColor: string;
  bodyBottomColor: string;
  causticColor: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface BodyTelemetry {
  id: number;
  labelFa: string;
  shape: ShapeKind;
  materialId: MaterialId;
  density: number; // kg/m³
  mass: number; // kg
  volumeLiters: number; // L (1 L = 0.001 m³)
  submergedVolumeLiters: number; // L
  submergedFraction: number; // 0..1
  restitution: number;
  friction: number;
  isStatic: boolean;
  scale: number; // relative visual/size scale multiplier
  speedMs: number; // m/s
  velocityMs: Vec2;
  positionM: Vec2;
  angleDeg: number;
  gravityForceN: number;
  buoyancyForceN: number;
  dragForceN: number;
  netForceN: Vec2;
  netForceMagN: number;
  stateFa: 'شناور' | 'غوطه‌ور در سیال' | 'در هوا' | 'روی بستر / ثابت';
}

export interface SimulationConfig {
  scenarioId: ScenarioId;
  gravity: number; // m/s²
  fluidId: FluidId;
  fluidDensity: number; // kg/m³
  fluidViscosity: number; // drag multiplier 0.2..6.0
  airResistance: number; // 0..0.1
  baseWaterFraction: number; // 0..0.85 fraction of tank height
  showForceVectors: boolean;
  showVelocityVector: boolean;
  showGrid: boolean;
  showWaterRefLine: boolean;
  showRuler: boolean;
  showScale: boolean;
  showStopwatch: boolean;
  timeScale: number; // 0.25 | 0.5 | 1
}

export interface SimulationStats {
  simTimeSec: number;
  bodyCount: number;
  waterLevelM: number; // height of water from tank floor in meters
  baseWaterLevelM: number; // initial water height without displaced volume
  waterVolumeLiters: number;
  displacedVolumeLiters: number;
  scaleReadingN: number;
  scaleReadingKg: number;
  scaleAttachedLabel: string | null;
}

export const WORLD_WIDTH = 960; // px
export const WORLD_HEIGHT = 600; // px
export const TANK_WALL_THICKNESS = 28; // px
export const PIXELS_PER_METER = 150; // 150 px = 1.00 m
export const SLAB_DEPTH_M = 0.20; // 20 cm 2.5D thickness

export const MATERIAL_PRESETS: Record<MaterialId, MaterialPreset> = {
  wood: {
    id: 'wood',
    nameFa: 'چوب',
    density: 600,
    restitution: 0.42,
    friction: 0.45,
    fillColor: '#D9A773',
    strokeColor: '#9A6332',
    accentColor: '#B87E48',
  },
  ice: {
    id: 'ice',
    nameFa: 'یخ',
    density: 917,
    restitution: 0.35,
    friction: 0.04,
    fillColor: '#BAE6FD',
    strokeColor: '#0284C7',
    accentColor: '#E0F2FE',
  },
  rubber: {
    id: 'rubber',
    nameFa: 'لاستیک',
    density: 1100,
    restitution: 0.88,
    friction: 0.72,
    fillColor: '#475569',
    strokeColor: '#1E293B',
    accentColor: '#64748B',
  },
  brick: {
    id: 'brick',
    nameFa: 'آجر',
    density: 1900,
    restitution: 0.20,
    friction: 0.68,
    fillColor: '#C2594B',
    strokeColor: '#7F2D22',
    accentColor: '#9E3E31',
  },
  aluminum: {
    id: 'aluminum',
    nameFa: 'آلومینیوم',
    density: 2700,
    restitution: 0.55,
    friction: 0.32,
    fillColor: '#CBD5E1',
    strokeColor: '#64748B',
    accentColor: '#E2E8F0',
  },
  steel: {
    id: 'steel',
    nameFa: 'فولاد',
    density: 7850,
    restitution: 0.62,
    friction: 0.28,
    fillColor: '#94A3B8',
    strokeColor: '#334155',
    accentColor: '#CBD5E1',
  },
  gold: {
    id: 'gold',
    nameFa: 'طلا',
    density: 19300,
    restitution: 0.30,
    friction: 0.35,
    fillColor: '#F5C451',
    strokeColor: '#92600A',
    accentColor: '#FDE68A',
  },
  custom: {
    id: 'custom',
    nameFa: 'دلخواه',
    density: 1200,
    restitution: 0.50,
    friction: 0.40,
    fillColor: '#818CF8',
    strokeColor: '#4338CA',
    accentColor: '#A5B4FC',
  },
};

export const FLUID_PRESETS: Record<FluidId, FluidPreset> = {
  water: {
    id: 'water',
    nameFa: 'آب خالص',
    density: 1000,
    viscosityMultiplier: 1.0,
    surfaceColor: '#0284C7',
    bodyTopColor: 'rgba(56, 189, 248, 0.30)',
    bodyBottomColor: 'rgba(2, 132, 199, 0.48)',
    causticColor: 'rgba(255, 255, 255, 0.22)',
  },
  oil: {
    id: 'oil',
    nameFa: 'روغن',
    density: 800,
    viscosityMultiplier: 2.2,
    surfaceColor: '#D97706',
    bodyTopColor: 'rgba(251, 191, 36, 0.32)',
    bodyBottomColor: 'rgba(217, 119, 6, 0.46)',
    causticColor: 'rgba(254, 243, 199, 0.26)',
  },
  ethanol: {
    id: 'ethanol',
    nameFa: 'اتانول (الکل)',
    density: 789,
    viscosityMultiplier: 0.85,
    surfaceColor: '#0D9488',
    bodyTopColor: 'rgba(94, 234, 212, 0.24)',
    bodyBottomColor: 'rgba(13, 148, 136, 0.36)',
    causticColor: 'rgba(255, 255, 255, 0.20)',
  },
  saltwater: {
    id: 'saltwater',
    nameFa: 'آب‌نمک اشباع',
    density: 1200,
    viscosityMultiplier: 1.25,
    surfaceColor: '#0369A1',
    bodyTopColor: 'rgba(14, 165, 233, 0.36)',
    bodyBottomColor: 'rgba(7, 89, 133, 0.56)',
    causticColor: 'rgba(224, 242, 254, 0.26)',
  },
  glycerin: {
    id: 'glycerin',
    nameFa: 'گلیسیرین',
    density: 1260,
    viscosityMultiplier: 4.8,
    surfaceColor: '#059669',
    bodyTopColor: 'rgba(52, 211, 153, 0.28)',
    bodyBottomColor: 'rgba(5, 150, 105, 0.46)',
    causticColor: 'rgba(236, 253, 245, 0.25)',
  },
  mercury: {
    id: 'mercury',
    nameFa: 'جیوه',
    density: 13600,
    viscosityMultiplier: 1.7,
    surfaceColor: '#475569',
    bodyTopColor: 'rgba(148, 163, 184, 0.72)',
    bodyBottomColor: 'rgba(71, 85, 105, 0.88)',
    causticColor: 'rgba(248, 250, 252, 0.40)',
  },
  custom: {
    id: 'custom',
    nameFa: 'سیال دلخواه',
    density: 1000,
    viscosityMultiplier: 1.0,
    surfaceColor: '#0284C7',
    bodyTopColor: 'rgba(56, 189, 248, 0.30)',
    bodyBottomColor: 'rgba(2, 132, 199, 0.48)',
    causticColor: 'rgba(255, 255, 255, 0.22)',
  },
};
