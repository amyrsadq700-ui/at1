import * as THREE from 'three';
import {
  INNER_TANK_BOTTOM,
  INNER_TANK_HEIGHT,
  INNER_TANK_WIDTH,
  PhysicsWorld,
  WAVE_COLUMN_COUNT,
} from '../physics/engine';
import { PIXELS_PER_METER, type FluidId } from '../physics/types';
import type { ProceduralTexturePack } from './proceduralTextures';

export const TANK_WIDTH_3D = INNER_TANK_WIDTH / PIXELS_PER_METER; // ~6.027 m
export const TANK_HEIGHT_3D = INNER_TANK_HEIGHT / PIXELS_PER_METER; // ~3.707 m
export const TANK_DEPTH_3D = 1.56; // meters

interface FluidShaderAppearance {
  surfaceColor: number;
  deepColor: number;
  opacity: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
  causticOpacity: number;
}

const FLUID_3D_STYLES: Record<FluidId, FluidShaderAppearance> = {
  water: {
    surfaceColor: 0x38bdf8,
    deepColor: 0x0284c7,
    opacity: 0.56,
    roughness: 0.06,
    metalness: 0.02,
    clearcoat: 1.0,
    causticOpacity: 0.36,
  },
  oil: {
    surfaceColor: 0xfbbf24,
    deepColor: 0xb45309,
    opacity: 0.64,
    roughness: 0.1,
    metalness: 0.0,
    clearcoat: 0.95,
    causticOpacity: 0.22,
  },
  ethanol: {
    surfaceColor: 0x5eead4,
    deepColor: 0x0f766e,
    opacity: 0.45,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    causticOpacity: 0.3,
  },
  saltwater: {
    surfaceColor: 0x0ea5e9,
    deepColor: 0x075985,
    opacity: 0.65,
    roughness: 0.07,
    metalness: 0.02,
    clearcoat: 1.0,
    causticOpacity: 0.34,
  },
  glycerin: {
    surfaceColor: 0x34d399,
    deepColor: 0x047857,
    opacity: 0.62,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    causticOpacity: 0.25,
  },
  mercury: {
    surfaceColor: 0xcbd5e1,
    deepColor: 0x64748b,
    opacity: 0.96,
    roughness: 0.12,
    metalness: 0.92,
    clearcoat: 0.85,
    causticOpacity: 0.0,
  },
  custom: {
    surfaceColor: 0x38bdf8,
    deepColor: 0x0284c7,
    opacity: 0.58,
    roughness: 0.06,
    metalness: 0.02,
    clearcoat: 1.0,
    causticOpacity: 0.32,
  },
};

export interface WaterAndTankSystem {
  group: THREE.Group;
  update: (world: PhysicsWorld, elapsedSec: number) => void;
  setStudioTone: (benchTintHex: number, floorTintHex: number) => void;
  dispose: () => void;
}

export function createWaterAndTankSystem(
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean
): WaterAndTankSystem {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const halfW = TANK_WIDTH_3D * 0.5;
  const halfD = TANK_DEPTH_3D * 0.5;

  // 1. Laboratory Room Floor & Bench
  textures.labBenchAlbedo.repeat.set(8, 6);
  const benchGeo = new THREE.BoxGeometry(36, 0.18, 26);
  const benchMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.labBenchAlbedo,
    roughness: 0.78,
    metalness: 0.04,
  });
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.position.set(0, -0.15, 0);
  bench.receiveShadow = true;
  group.add(bench);
  disposables.push(benchGeo, benchMat);

  // Tank ceramic/quartz inner floor slab (y top = 0.00)
  const tankFloorGeo = new THREE.BoxGeometry(TANK_WIDTH_3D + 0.08, 0.06, TANK_DEPTH_3D + 0.08);
  const tankFloorMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.52,
    metalness: 0.08,
  });
  const tankFloor = new THREE.Mesh(tankFloorGeo, tankFloorMat);
  tankFloor.position.set(0, -0.03, 0);
  tankFloor.receiveShadow = true;
  group.add(tankFloor);
  disposables.push(tankFloorGeo, tankFloorMat);

  // 2. Anodized Aluminum Aquarium Frame Posts & Rails
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.32,
    metalness: 0.85,
  });
  disposables.push(frameMat);

  const postGeo = new THREE.BoxGeometry(0.055, TANK_HEIGHT_3D + 0.06, 0.055);
  disposables.push(postGeo);
  const postCoords: [number, number][] = [
    [-halfW - 0.025, -halfD - 0.025],
    [halfW + 0.025, -halfD - 0.025],
    [-halfW - 0.025, halfD + 0.025],
    [halfW + 0.025, halfD + 0.025],
  ];
  for (const [px, pz] of postCoords) {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(px, TANK_HEIGHT_3D * 0.5, pz);
    post.castShadow = !isSoftwareGl;
    group.add(post);
  }

  const railXGeo = new THREE.BoxGeometry(TANK_WIDTH_3D + 0.1, 0.045, 0.055);
  const railZGeo = new THREE.BoxGeometry(0.055, 0.045, TANK_DEPTH_3D + 0.1);
  disposables.push(railXGeo, railZGeo);

  for (const ry of [0.0, TANK_HEIGHT_3D + 0.02]) {
    for (const rz of [-halfD - 0.025, halfD + 0.025]) {
      const rx = new THREE.Mesh(railXGeo, frameMat);
      rx.position.set(0, ry, rz);
      group.add(rx);
    }
    for (const rxPos of [-halfW - 0.025, halfW + 0.025]) {
      const rz = new THREE.Mesh(railZGeo, frameMat);
      rz.position.set(rxPos, ry, 0);
      group.add(rz);
    }
  }

  // 3. Graduated Metric Ruler Strip on Front-Left Glass Edge
  const scaleStripGeo = new THREE.PlaneGeometry(0.32, TANK_HEIGHT_3D);
  const scaleStripMat = new THREE.MeshBasicMaterial({
    map: textures.rulerScaleMap,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const scaleStrip = new THREE.Mesh(scaleStripGeo, scaleStripMat);
  scaleStrip.position.set(-halfW + 0.19, TANK_HEIGHT_3D * 0.5, halfD + 0.012);
  scaleStrip.renderOrder = 8;
  group.add(scaleStrip);
  disposables.push(scaleStripGeo, scaleStripMat);

  // 4. Optical Glass Tank Panels
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2f1fb,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    ior: 1.52,
    transmission: isSoftwareGl ? 0 : 0.9,
    transparent: true,
    opacity: isSoftwareGl ? 0.14 : 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  disposables.push(glassMat);

  const frontBackGeo = new THREE.PlaneGeometry(TANK_WIDTH_3D, TANK_HEIGHT_3D);
  const leftRightGeo = new THREE.PlaneGeometry(TANK_DEPTH_3D, TANK_HEIGHT_3D);
  disposables.push(frontBackGeo, leftRightGeo);

  const frontGlass = new THREE.Mesh(frontBackGeo, glassMat);
  frontGlass.position.set(0, TANK_HEIGHT_3D * 0.5, halfD);
  frontGlass.renderOrder = 7;

  const backGlass = new THREE.Mesh(frontBackGeo, glassMat);
  backGlass.position.set(0, TANK_HEIGHT_3D * 0.5, -halfD);
  backGlass.renderOrder = 3;

  const leftGlass = new THREE.Mesh(leftRightGeo, glassMat);
  leftGlass.rotation.y = Math.PI / 2;
  leftGlass.position.set(-halfW, TANK_HEIGHT_3D * 0.5, 0);
  leftGlass.renderOrder = 6;

  const rightGlass = new THREE.Mesh(leftRightGeo, glassMat);
  rightGlass.rotation.y = Math.PI / 2;
  rightGlass.position.set(halfW, TANK_HEIGHT_3D * 0.5, 0);
  rightGlass.renderOrder = 6;

  group.add(backGlass, leftGlass, rightGlass, frontGlass);

  // 5. Dynamic 3D Water Surface (PBR MeshPhysicalMaterial + onBeforeCompile Fresnel shimmer)
  const zSegs = 10;
  const surfaceGeo = new THREE.PlaneGeometry(
    TANK_WIDTH_3D - 0.012,
    TANK_DEPTH_3D - 0.012,
    WAVE_COLUMN_COUNT - 1,
    zSegs
  );
  surfaceGeo.rotateX(-Math.PI / 2);

  const waterSurfaceMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.06,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    ior: 1.333,
    reflectivity: 0.92,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Extend PBR surface with subtle procedural Fresnel + capillary ripple highlights
  waterSurfaceMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    waterSurfaceMat.userData.shader = shader;

    shader.vertexShader =
      `varying vec3 vWaterWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

    shader.fragmentShader =
      `uniform float uTime;\nvarying vec3 vWaterWorldPos;\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float microRipple = sin(vWaterWorldPos.x * 9.0 + uTime * 2.4) * cos(vWaterWorldPos.z * 11.0 - uTime * 1.9);
        diffuseColor.rgb += vec3(0.05, 0.08, 0.11) * (0.5 + 0.5 * microRipple);
        `
      );
  };

  const surfaceMesh = new THREE.Mesh(surfaceGeo, waterSurfaceMat);
  surfaceMesh.renderOrder = 5;
  group.add(surfaceMesh);
  disposables.push(surfaceGeo, waterSurfaceMat);

  // 6. Dynamic Water Front & Side Volume Skirts (matching wave crest to tank floor!)
  const skirtMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.02,
    clearcoat: 0.8,
    transparent: true,
    opacity: 0.44,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  disposables.push(skirtMat);

  const frontSkirtGeo = new THREE.PlaneGeometry(
    TANK_WIDTH_3D - 0.012,
    1.0,
    WAVE_COLUMN_COUNT - 1,
    1
  );
  const frontSkirt = new THREE.Mesh(frontSkirtGeo, skirtMat);
  frontSkirt.position.set(0, 0, halfD - 0.006);
  frontSkirt.renderOrder = 4;

  const backSkirt = new THREE.Mesh(frontSkirtGeo, skirtMat);
  backSkirt.position.set(0, 0, -halfD + 0.006);
  backSkirt.renderOrder = 2;

  const sideSkirtGeo = new THREE.PlaneGeometry(TANK_DEPTH_3D - 0.012, 1.0, zSegs, 1);
  const leftSkirt = new THREE.Mesh(sideSkirtGeo, skirtMat);
  leftSkirt.rotation.y = Math.PI / 2;
  leftSkirt.position.set(-halfW + 0.006, 0, 0);
  leftSkirt.renderOrder = 4;

  const rightSkirt = new THREE.Mesh(sideSkirtGeo, skirtMat);
  rightSkirt.rotation.y = Math.PI / 2;
  rightSkirt.position.set(halfW - 0.006, 0, 0);
  rightSkirt.renderOrder = 4;

  group.add(backSkirt, leftSkirt, rightSkirt, frontSkirt);
  disposables.push(frontSkirtGeo, sideSkirtGeo);

  // 7. Animated Underwater Caustics Floor Layer (y = +0.015 to avoid Z-fighting)
  const causticGeo = new THREE.PlaneGeometry(TANK_WIDTH_3D - 0.04, TANK_DEPTH_3D - 0.04);
  causticGeo.rotateX(-Math.PI / 2);
  const causticMat = new THREE.MeshBasicMaterial({
    map: textures.causticMap,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const causticPlane = new THREE.Mesh(causticGeo, causticMat);
  causticPlane.position.set(0, 0.015, 0);
  causticPlane.renderOrder = 2;
  group.add(causticPlane);
  disposables.push(causticGeo, causticMat);

  // 8. Instanced 3D Water Droplets (poured water + splash droplets)
  const maxDroplets = 120;
  const dropGeo = new THREE.SphereGeometry(0.026, 10, 8);
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.05,
    metalness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.8,
  });
  const dropletMesh = new THREE.InstancedMesh(dropGeo, dropMat, maxDroplets);
  dropletMesh.frustumCulled = false;
  dropletMesh.count = 0;
  dropletMesh.renderOrder = 5;
  group.add(dropletMesh);
  disposables.push(dropGeo, dropMat);

  const _dummyMatrix = new THREE.Matrix4();
  const _dummyPos = new THREE.Vector3();
  const _dummyQuat = new THREE.Quaternion();
  const _dummyScale = new THREE.Vector3();

  function update(world: PhysicsWorld, elapsedSec: number): void {
    const hasFluid = world.config.baseWaterFraction > 0.001;
    surfaceMesh.visible = hasFluid;
    frontSkirt.visible = hasFluid;
    backSkirt.visible = hasFluid;
    leftSkirt.visible = hasFluid;
    rightSkirt.visible = hasFluid;
    causticPlane.visible = hasFluid;

    const style = FLUID_3D_STYLES[world.config.fluidId] ?? FLUID_3D_STYLES.water;

    // Update fluid optical properties
    waterSurfaceMat.color.setHex(style.surfaceColor);
    waterSurfaceMat.roughness = style.roughness;
    waterSurfaceMat.metalness = style.metalness;
    waterSurfaceMat.clearcoat = style.clearcoat;
    waterSurfaceMat.opacity = Math.min(0.95, style.opacity + 0.08);
    if (waterSurfaceMat.userData.shader) {
      waterSurfaceMat.userData.shader.uniforms.uTime.value = elapsedSec;
    }

    skirtMat.color.setHex(style.deepColor);
    skirtMat.metalness = style.metalness * 0.8;
    skirtMat.roughness = Math.max(0.08, style.roughness);
    skirtMat.opacity = style.opacity * 0.78;

    dropMat.color.setHex(style.surfaceColor);
    causticMat.opacity = hasFluid ? style.causticOpacity : 0;

    if (hasFluid) {
      const baseWaterY3D =
        (INNER_TANK_BOTTOM - world.getWaterSurfaceY()) / PIXELS_PER_METER;
      const cols = world.waveColumns;

      // Update wave top surface mesh
      const surfPos = surfaceGeo.attributes.position as THREE.BufferAttribute;
      for (let iz = 0; iz <= zSegs; iz++) {
        const zNorm = iz / zSegs - 0.5;
        for (let ix = 0; ix < WAVE_COLUMN_COUNT; ix++) {
          const idx = iz * WAVE_COLUMN_COUNT + ix;
          const xVal = surfPos.getX(idx);
          const waveY = -cols[ix].height / PIXELS_PER_METER;
          const crossRipple =
            Math.sin(xVal * 2.8 + elapsedSec * 2.1) *
            Math.cos(zNorm * 4.5 - elapsedSec * 1.6) *
            0.009;
          const finalY = Math.max(0.02, baseWaterY3D + waveY + crossRipple);
          surfPos.setY(idx, finalY);
        }
      }
      surfPos.needsUpdate = true;
      surfaceGeo.computeVertexNormals();

      // Update front/back skirt top row to lock tightly to wave crest
      const fPos = frontSkirtGeo.attributes.position as THREE.BufferAttribute;
      for (let ix = 0; ix < WAVE_COLUMN_COUNT; ix++) {
        const waveY = -cols[ix].height / PIXELS_PER_METER;
        const crestY = Math.max(0.02, baseWaterY3D + waveY);
        // Top row of PlaneGeometry is indices [0 .. WAVE_COLUMN_COUNT-1]
        fPos.setY(ix, crestY);
        // Bottom row pinned to tank floor
        fPos.setY(WAVE_COLUMN_COUNT + ix, 0.004);
      }
      fPos.needsUpdate = true;
      frontSkirtGeo.computeVertexNormals();

      // Update left/right side skirt heights
      const sPos = sideSkirtGeo.attributes.position as THREE.BufferAttribute;
      const leftCrest = Math.max(0.02, baseWaterY3D - cols[0].height / PIXELS_PER_METER);
      const rightCrest = Math.max(
        0.02,
        baseWaterY3D - cols[WAVE_COLUMN_COUNT - 1].height / PIXELS_PER_METER
      );
      const avgCrest = (leftCrest + rightCrest) * 0.5;
      for (let ix = 0; ix <= zSegs; ix++) {
        sPos.setY(ix, avgCrest);
        sPos.setY(zSegs + 1 + ix, 0.004);
      }
      sPos.needsUpdate = true;

      // Animate caustics UV offset
      textures.causticMap.offset.set(elapsedSec * 0.04, Math.sin(elapsedSec * 0.5) * 0.03);
    }

    // Update InstancedMesh droplets
    const count = Math.min(maxDroplets, world.droplets.length);
    dropletMesh.count = count;
    for (let i = 0; i < count; i++) {
      const d = world.droplets[i];
      const dx = (d.x - INNER_TANK_WIDTH * 0.5 - 28) / PIXELS_PER_METER;
      const dy = (INNER_TANK_BOTTOM - d.y) / PIXELS_PER_METER;
      const s = Math.max(0.6, d.radius / 3.5);
      _dummyPos.set(dx, dy, 0);
      _dummyScale.set(s, s * 1.25, s);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      dropletMesh.setMatrixAt(i, _dummyMatrix);
    }
    if (count > 0) {
      dropletMesh.instanceMatrix.needsUpdate = true;
    }
  }

  function setStudioTone(benchTintHex: number, floorTintHex: number): void {
    benchMat.color.setHex(benchTintHex);
    tankFloorMat.color.setHex(floorTintHex);
  }

  return {
    group,
    update,
    setStudioTone,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
