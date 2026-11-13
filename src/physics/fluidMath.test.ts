import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areaPxToVolumeM3,
  computeBuoyancyForceN,
  computeCircleSubmersion,
  computeDisplacedWaterRisePx,
  computeFluidDragForceN,
  computePolygonAreaAndCentroid,
  computePolygonSubmersion,
  stepWaveColumns,
  type WaveColumn,
} from './fluidMath';

test('computePolygonAreaAndCentroid computes exact rectangle area and center', () => {
  const rect = [
    { x: 100, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 260 },
    { x: 100, y: 260 },
  ];
  const res = computePolygonAreaAndCentroid(rect);
  assert.equal(Math.round(res.area), 6000);
  assert.ok(Math.abs(res.centroid.x - 150) < 1e-6);
  assert.ok(Math.abs(res.centroid.y - 230) < 1e-6);
});

test('computePolygonSubmersion handles dry, half-submerged, and fully submerged states', () => {
  // 100x100 square centered at (150, 250): y spans [200, 300]
  const square = [
    { x: 100, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 300 },
    { x: 100, y: 300 },
  ];

  // Water at y=350 -> completely above water
  const dry = computePolygonSubmersion(square, 350);
  assert.equal(dry.submergedFraction, 0);
  assert.equal(dry.submergedAreaPx2, 0);

  // Water at y=250 -> exact 50% submerged, center of buoyancy in bottom half (y=275)
  const half = computePolygonSubmersion(square, 250);
  assert.ok(Math.abs(half.submergedFraction - 0.5) < 1e-6);
  assert.ok(Math.abs(half.submergedAreaPx2 - 5000) < 1e-4);
  assert.ok(Math.abs(half.submergedCentroid.y - 275) < 1e-4);

  // Water at y=100 -> completely submerged
  const full = computePolygonSubmersion(square, 100);
  assert.ok(Math.abs(full.submergedFraction - 1.0) < 1e-6);
  assert.ok(Math.abs(full.submergedCentroid.y - 250) < 1e-4);
});

test('computeCircleSubmersion matches exact analytic segment geometry', () => {
  const center = { x: 200, y: 300 };
  const radius = 50;
  const fullArea = Math.PI * 2500;

  const dry = computeCircleSubmersion(center, radius, 360);
  assert.equal(dry.submergedFraction, 0);

  const half = computeCircleSubmersion(center, radius, 300);
  assert.ok(Math.abs(half.submergedFraction - 0.5) < 1e-6);
  assert.ok(Math.abs(half.submergedAreaPx2 - fullArea * 0.5) < 1e-3);
  // Semicircle centroid from flat top edge is 4r / (3pi)
  const expectedOffset = (4 * radius) / (3 * Math.PI);
  assert.ok(Math.abs(half.submergedCentroid.y - (300 + expectedOffset)) < 1e-3);

  const full = computeCircleSubmersion(center, radius, 200);
  assert.equal(full.submergedFraction, 1);
});

test('Archimedes equilibrium: wood (500 kg/m³) balances gravity at 50% submersion in water (1000 kg/m³)', () => {
  const ppm = 150;
  const depth = 0.2;
  const areaPx2 = 75 * 75; // 0.5m x 0.5m
  const totalVol = areaPxToVolumeM3(areaPx2, ppm, depth); // 0.05 m³
  const woodMass = totalVol * 500; // 25 kg
  const g = 9.81;
  const weightN = woodMass * g;

  const buoyancyAtHalf = computeBuoyancyForceN(1000, totalVol * 0.5, g);
  assert.ok(Math.abs(buoyancyAtHalf - weightN) < 1e-6);
});

test('Water displacement rise equals submerged area divided by tank width', () => {
  const rise = computeDisplacedWaterRisePx(9000, 900, 200);
  assert.equal(rise, 10);
});

test('Hydrodynamic drag opposes velocity vector and scales with submersion', () => {
  const drag = computeFluidDragForceN({ x: 2, y: -1 }, 0.5, 0.5, 0.2, 1000, 1.0);
  assert.ok(drag.x < 0);
  assert.ok(drag.y > 0);

  const zeroDrag = computeFluidDragForceN({ x: 2, y: -1 }, 0, 0.5, 0.2, 1000, 1.0);
  assert.equal(zeroDrag.x, 0);
  assert.equal(zeroDrag.y, 0);
});

test('Wave column simulation propagates ripples and decays over time', () => {
  const cols: WaveColumn[] = Array.from({ length: 21 }, () => ({
    height: 0,
    targetHeight: 0,
    velocity: 0,
  }));
  cols[10].velocity = 12;

  for (let step = 0; step < 10; step++) {
    stepWaveColumns(cols);
  }
  // Ripple should have spread to neighbors
  assert.ok(Math.abs(cols[8].height) > 0.01 || Math.abs(cols[12].height) > 0.01);

  const peakAfter10 = Math.max(...cols.map((c) => Math.abs(c.height)));
  for (let step = 0; step < 300; step++) {
    stepWaveColumns(cols);
  }
  const peakAfter310 = Math.max(...cols.map((c) => Math.abs(c.height)));
  assert.ok(peakAfter310 < peakAfter10);
});
