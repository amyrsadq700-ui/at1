import type { MaterialId, ScenarioId, ShapeKind } from './types';

export interface ScenarioBodySpec {
  shape: ShapeKind;
  materialId: MaterialId;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  vertices?: { x: number; y: number }[];
  angleRad?: number;
  isStatic?: boolean;
  velocityMs?: { x: number; y: number };
  labelFa: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  titleFa: string;
  subtitleFa: string;
  gravity: number;
  fluidId: 'water' | 'oil' | 'saltwater' | 'glycerin' | 'mercury';
  baseWaterFraction: number;
  airResistance: number;
  showForceVectors: boolean;
  showVelocityVector: boolean;
  bodies: ScenarioBodySpec[];
}

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  buoyancy: {
    id: 'buoyancy',
    titleFa: 'شناوری و ارشمیدس',
    subtitleFa: 'بررسی نیروی شناوری، جابه‌جایی آب و تعادل چگالی در سیال',
    gravity: 9.81,
    fluidId: 'water',
    baseWaterFraction: 0.46,
    airResistance: 0.005,
    showForceVectors: true,
    showVelocityVector: false,
    bodies: [
      {
        shape: 'box',
        materialId: 'wood',
        x: 240,
        y: 230,
        width: 82,
        height: 82,
        angleRad: 0.14,
        labelFa: 'مکعب چوبی',
      },
      {
        shape: 'circle',
        materialId: 'ice',
        x: 450,
        y: 250,
        radius: 38,
        labelFa: 'کره یخی',
      },
      {
        shape: 'box',
        materialId: 'brick',
        x: 640,
        y: 190,
        width: 72,
        height: 54,
        labelFa: 'آجر',
      },
      {
        shape: 'circle',
        materialId: 'steel',
        x: 785,
        y: 160,
        radius: 30,
        labelFa: 'گلوله فولادی',
      },
    ],
  },
  ramp: {
    id: 'ramp',
    titleFa: 'سطح شیب‌دار و اصطکاک',
    subtitleFa: 'لغزش و غلتش اجسام روی سطح شیب‌دار و ورود به حوضچه سیال',
    gravity: 9.81,
    fluidId: 'water',
    baseWaterFraction: 0.24,
    airResistance: 0.004,
    showForceVectors: true,
    showVelocityVector: true,
    bodies: [
      {
        shape: 'ramp',
        materialId: 'aluminum',
        x: 235,
        y: 445,
        width: 340,
        height: 185,
        isStatic: true,
        labelFa: 'سطح شیب‌دار اصلی',
      },
      {
        shape: 'box',
        materialId: 'ice',
        x: 135,
        y: 260,
        width: 56,
        height: 56,
        angleRad: 0.5,
        labelFa: 'بلوک یخی (کم‌اصطکاک)',
      },
      {
        shape: 'circle',
        materialId: 'rubber',
        x: 215,
        y: 305,
        radius: 28,
        labelFa: 'توپ لاستیکی',
      },
      {
        shape: 'box',
        materialId: 'wood',
        x: 720,
        y: 380,
        width: 84,
        height: 58,
        labelFa: 'تخته چوبی',
      },
    ],
  },
  collisions: {
    id: 'collisions',
    titleFa: 'برخورد و تکانه',
    subtitleFa: 'بررسی ضریب کشسانی، انتقال تکانه و حرکت پرتابی',
    gravity: 9.81,
    fluidId: 'water',
    baseWaterFraction: 0.0,
    airResistance: 0.002,
    showForceVectors: false,
    showVelocityVector: true,
    bodies: [
      {
        shape: 'circle',
        materialId: 'rubber',
        x: 170,
        y: 320,
        radius: 34,
        velocityMs: { x: 4.2, y: -1.8 },
        labelFa: 'توپ لاستیکی ۱',
      },
      {
        shape: 'circle',
        materialId: 'rubber',
        x: 420,
        y: 530,
        radius: 34,
        velocityMs: { x: -1.5, y: 0 },
        labelFa: 'توپ لاستیکی ۲',
      },
      {
        shape: 'circle',
        materialId: 'steel',
        x: 620,
        y: 525,
        radius: 38,
        labelFa: 'گوی فولادی سنگین',
      },
      {
        shape: 'box',
        materialId: 'wood',
        x: 760,
        y: 520,
        width: 68,
        height: 68,
        labelFa: 'مکعب چوبی',
      },
      {
        shape: 'box',
        materialId: 'wood',
        x: 760,
        y: 445,
        width: 68,
        height: 68,
        labelFa: 'مکعب چوبی بالایی',
      },
    ],
  },
  sandbox: {
    id: 'sandbox',
    titleFa: 'آزمایشگاه آزاد',
    subtitleFa: 'محیط خالی برای ساخت اشکال دلخواه، ریختن آب و آزمایش آزاد',
    gravity: 9.81,
    fluidId: 'water',
    baseWaterFraction: 0.36,
    airResistance: 0.005,
    showForceVectors: true,
    showVelocityVector: true,
    bodies: [
      {
        shape: 'polygon',
        materialId: 'wood',
        x: 480,
        y: 250,
        vertices: [
          { x: -45, y: -25 },
          { x: 45, y: -25 },
          { x: 60, y: 25 },
          { x: -60, y: 25 },
        ],
        labelFa: 'ذوزنقه چوبی (قایق)',
      },
    ],
  },
};
