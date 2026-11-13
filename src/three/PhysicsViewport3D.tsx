import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  INNER_TANK_BOTTOM,
  INNER_TANK_HEIGHT,
  INNER_TANK_LEFT,
  INNER_TANK_RIGHT,
  INNER_TANK_TOP,
  INNER_TANK_WIDTH,
  PhysicsWorld,
} from '../physics/engine';
import {
  PIXELS_PER_METER,
  type InteractionTool,
  type MaterialId,
  type ShapeKind,
  type Vec2,
} from '../physics/types';
import { buildCompositeBodyMesh, disposeObject3D } from './bodyFactory';
import { createProceduralTexturePack } from './proceduralTextures';
import {
  TANK_DEPTH_3D,
  TANK_HEIGHT_3D,
  TANK_WIDTH_3D,
  createWaterAndTankSystem,
} from './waterSystem';

export type CameraPreset3D = 'isometric' | 'front' | 'top';
export type LightingPreset3D = 'lab-day' | 'warm-studio' | 'dramatic';
export type RenderQuality3D = 'balanced' | 'ultra';

interface PhysicsViewport3DProps {
  worldRef: React.MutableRefObject<PhysicsWorld | null>;
  isRunning: boolean;
  activeTool: InteractionTool;
  spawnMaterial: MaterialId;
  cameraPreset: CameraPreset3D;
  cameraTrigger: number;
  lightingPreset: LightingPreset3D;
  renderQuality: RenderQuality3D;
  onSelectTool: (tool: InteractionTool) => void;
  onSyncUi: () => void;
}

interface BodyMeshRecord {
  group: THREE.Group;
  scale: number;
  materialId: MaterialId;
  shape: ShapeKind;
  isStatic: boolean;
}

const TANK_CENTER_X_PX = INNER_TANK_LEFT + INNER_TANK_WIDTH * 0.5;

const CAMERA_PRESET_TARGETS: Record<
  CameraPreset3D,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  isometric: { pos: [2.55, 2.8, 7.65], target: [0, 1.72, 0] },
  front: { pos: [0, 1.88, 7.85], target: [0, 1.8, 0] },
  top: { pos: [0, 7.3, 2.4], target: [0, 1.15, 0] },
};

const LIGHTING_PRESETS: Record<
  LightingPreset3D,
  {
    bgHex: number;
    fogDensity: number;
    keyColor: number;
    keyIntensity: number;
    keyPos: [number, number, number];
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    rimColor: number;
    rimIntensity: number;
    softboxColor: number;
    softboxIntensity: number;
    envIntensity: number;
    backdropColor: number;
    benchTint: number;
    floorTint: number;
    exposure: number;
  }
> = {
  'lab-day': {
    bgHex: 0xe8eff6,
    fogDensity: 0.024,
    keyColor: 0xfffdf8,
    keyIntensity: 2.55,
    keyPos: [4.2, 7.6, 5.4],
    hemiSky: 0xdbeafe,
    hemiGround: 0xcbd5e1,
    hemiIntensity: 0.85,
    rimColor: 0xbae6fd,
    rimIntensity: 1.05,
    softboxColor: 0xffffff,
    softboxIntensity: 3.1,
    envIntensity: 0.9,
    backdropColor: 0xdce6f0,
    benchTint: 0xffffff,
    floorTint: 0xf1f5f9,
    exposure: 1.06,
  },
  'warm-studio': {
    bgHex: 0xede7df,
    fogDensity: 0.024,
    keyColor: 0xfff0d6,
    keyIntensity: 2.75,
    keyPos: [4.8, 7.2, 4.9],
    hemiSky: 0xfef3c7,
    hemiGround: 0xd6d3d1,
    hemiIntensity: 0.82,
    rimColor: 0xcbd5e1,
    rimIntensity: 1.15,
    softboxColor: 0xfff7ed,
    softboxIntensity: 3.4,
    envIntensity: 0.92,
    backdropColor: 0xe2dbd1,
    benchTint: 0xfaf4ea,
    floorTint: 0xf5f0e8,
    exposure: 1.08,
  },
  dramatic: {
    bgHex: 0x172030,
    fogDensity: 0.032,
    keyColor: 0xf8fafc,
    keyIntensity: 3.15,
    keyPos: [3.6, 8.0, 4.5],
    hemiSky: 0x94a3b8,
    hemiGround: 0x1e293b,
    hemiIntensity: 0.45,
    rimColor: 0x38bdf8,
    rimIntensity: 1.6,
    softboxColor: 0xe0f2fe,
    softboxIntensity: 2.8,
    envIntensity: 0.8,
    backdropColor: 0x1e293b,
    benchTint: 0x475569,
    floorTint: 0x94a3b8,
    exposure: 1.12,
  },
};

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl =
      (probe.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probe.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const rendererName = String(
        gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? ''
      );
      if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName)) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

function pxTo3D(pt: Vec2): { x: number; y: number } {
  return {
    x: (pt.x - TANK_CENTER_X_PX) / PIXELS_PER_METER,
    y: (INNER_TANK_BOTTOM - pt.y) / PIXELS_PER_METER,
  };
}

function world3DToPx(x3: number, y3: number): Vec2 {
  return {
    x: Math.max(
      INNER_TANK_LEFT + 12,
      Math.min(INNER_TANK_RIGHT - 12, x3 * PIXELS_PER_METER + TANK_CENTER_X_PX)
    ),
    y: Math.max(
      INNER_TANK_TOP + 12,
      Math.min(INNER_TANK_BOTTOM - 12, INNER_TANK_BOTTOM - y3 * PIXELS_PER_METER)
    ),
  };
}

export function PhysicsViewport3D({
  worldRef,
  isRunning,
  activeTool,
  spawnMaterial,
  cameraPreset,
  cameraTrigger,
  lightingPreset,
  renderQuality,
  onSelectTool,
  onSyncUi,
}: PhysicsViewport3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Latest props in refs so WebGL mount effect never tears down on UI interactions
  const isRunningRef = useRef(isRunning);
  const activeToolRef = useRef(activeTool);
  const spawnMaterialRef = useRef(spawnMaterial);
  const lightingPresetRef = useRef(lightingPreset);
  const renderQualityRef = useRef(renderQuality);
  const onSelectToolRef = useRef(onSelectTool);
  const onSyncUiRef = useRef(onSyncUi);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    spawnMaterialRef.current = spawnMaterial;
  }, [spawnMaterial]);

  useEffect(() => {
    lightingPresetRef.current = lightingPreset;
  }, [lightingPreset]);

  useEffect(() => {
    renderQualityRef.current = renderQuality;
  }, [renderQuality]);

  useEffect(() => {
    onSelectToolRef.current = onSelectTool;
    onSyncUiRef.current = onSyncUi;
  }, [onSelectTool, onSyncUi]);

  // Camera transition target ref updated when user selects a preset
  const cameraTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESET_TARGETS.isometric.pos),
    target: new THREE.Vector3(...CAMERA_PRESET_TARGETS.isometric.target),
  });

  useEffect(() => {
    const spec = CAMERA_PRESET_TARGETS[cameraPreset];
    cameraTransitionRef.current.pos.set(...spec.pos);
    cameraTransitionRef.current.target.set(...spec.target);
    cameraTransitionRef.current.active = true;
  }, [cameraPreset, cameraTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const castShadows = !isSoftwareGl;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = castShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight)
    );
    renderer.domElement.className = 'block h-full w-full touch-none outline-none';
    renderer.domElement.setAttribute('data-testid', 'physics-canvas-3d');
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const initialLight = LIGHTING_PRESETS[lightingPresetRef.current];
    scene.background = new THREE.Color(initialLight.bgHex);
    scene.fog = new THREE.FogExp2(initialLight.bgHex, initialLight.fogDensity);

    // PBR Environment IBL
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = initialLight.envIntensity;

    // Camera & Controls
    const initCam = CAMERA_PRESET_TARGETS[cameraPreset];
    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      60
    );
    camera.position.set(...initCam.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initCam.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.6;
    controls.maxDistance = 12.5;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minPolarAngle = 0.12;
    controls.update();

    const cancelTransition = () => {
      cameraTransitionRef.current.active = false;
    };
    controls.addEventListener('start', cancelTransition);

    // Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initialLight.hemiSky,
      initialLight.hemiGround,
      initialLight.hemiIntensity
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(
      initialLight.keyColor,
      initialLight.keyIntensity
    );
    keyLight.position.set(...initialLight.keyPos);
    keyLight.castShadow = castShadows;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -4.5;
    keyLight.shadow.camera.right = 4.5;
    keyLight.shadow.camera.top = 4.5;
    keyLight.shadow.camera.bottom = -1.5;
    keyLight.shadow.bias = -0.0006;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
      initialLight.rimColor,
      initialLight.rimIntensity
    );
    rimLight.position.set(-4.5, 4.2, -5.0);
    scene.add(rimLight);

    let softboxLight: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      softboxLight = new THREE.RectAreaLight(
        initialLight.softboxColor,
        initialLight.softboxIntensity,
        6.5,
        2.2
      );
      softboxLight.position.set(0, 5.4, 1.4);
      softboxLight.lookAt(0, 1.2, 0);
      scene.add(softboxLight);
    }

    // Studio Cyclorama Wall (gives soft architectural depth behind aquarium)
    const wallGeo = new THREE.PlaneGeometry(38, 18);
    const wallMat = new THREE.MeshStandardMaterial({
      color: initialLight.backdropColor,
      roughness: 0.92,
      metalness: 0.02,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 5.5, -5.6);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Procedural Textures + Tank & Dynamic Water
    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const textures = createProceduralTexturePack(maxAnisotropy);
    const waterSystem = createWaterAndTankSystem(textures, isSoftwareGl);
    waterSystem.setStudioTone(initialLight.benchTint, initialLight.floorTint);
    scene.add(waterSystem.group);

    // Optional Calibration Grid inside Tank Back Wall
    const gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.22,
    });
    const gridZ = -TANK_DEPTH_3D * 0.5 + 0.014;
    const gridStepM = 0.5;
    const gridVerts: number[] = [];
    for (let x = -TANK_WIDTH_3D * 0.5; x <= TANK_WIDTH_3D * 0.5 + 0.01; x += gridStepM) {
      gridVerts.push(x, 0, gridZ, x, TANK_HEIGHT_3D, gridZ);
    }
    for (let y = 0; y <= TANK_HEIGHT_3D + 0.01; y += gridStepM) {
      gridVerts.push(-TANK_WIDTH_3D * 0.5, y, gridZ, TANK_WIDTH_3D * 0.5, y, gridZ);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridVerts, 3));
    const gridLines = new THREE.LineSegments(gridGeo, gridMat);
    gridGroup.add(gridLines);
    scene.add(gridGroup);

    // 3D Metric Ruler Overlay Object
    const rulerGroup = new THREE.Group();
    const rulerGeo = new THREE.BoxGeometry(2.0, 0.22, 0.03);
    const rulerMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.35,
      metalness: 0.25,
    });
    const rulerBar = new THREE.Mesh(rulerGeo, rulerMat);
    rulerBar.position.set(1.0, -0.11, 0);
    rulerGroup.add(rulerBar);

    // Ruler graduation ticks
    const tickMat = new THREE.MeshBasicMaterial({ color: 0x78350f });
    const tickGeo = new THREE.BoxGeometry(0.012, 0.08, 0.035);
    for (let i = 0; i <= 20; i++) {
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.set(i * 0.1, i % 5 === 0 ? -0.04 : -0.025, 0);
      tick.scale.y = i % 5 === 0 ? 1.2 : 0.75;
      rulerGroup.add(tick);
    }
    rulerGroup.visible = false;
    scene.add(rulerGroup);

    // 3D Hanging Spring Scale Object
    const scaleGroup = new THREE.Group();
    const scaleHousingGeo = new THREE.BoxGeometry(0.28, 0.56, 0.16);
    const scaleHousingMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.75,
    });
    const scaleHousing = new THREE.Mesh(scaleHousingGeo, scaleHousingMat);
    scaleGroup.add(scaleHousing);

    const scaleDialGeo = new THREE.BoxGeometry(0.22, 0.38, 0.175);
    const scaleDialMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
    });
    const scaleDial = new THREE.Mesh(scaleDialGeo, scaleDialMat);
    scaleGroup.add(scaleDial);

    const scaleHookGeo = new THREE.TorusGeometry(0.06, 0.015, 8, 20, Math.PI * 1.45);
    const scaleHookMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.88,
      roughness: 0.25,
    });
    const scaleHook = new THREE.Mesh(scaleHookGeo, scaleHookMat);
    scaleHook.position.set(0, -0.34, 0);
    scaleHook.rotation.z = Math.PI * 0.75;
    scaleGroup.add(scaleHook);

    const cordGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.5, 0),
    ]);
    const cordMat = new THREE.LineBasicMaterial({ color: 0x334155 });
    const scaleCord = new THREE.Line(cordGeo, cordMat);
    scaleGroup.add(scaleCord);
    scaleGroup.visible = false;
    scene.add(scaleGroup);

    // 3D Force & Velocity Vector Arrows (pre-allocated)
    const zeroDir = new THREE.Vector3(0, 1, 0);
    const zeroOrigin = new THREE.Vector3(0, 0, 0);
    const gravityArrow = new THREE.ArrowHelper(zeroDir, zeroOrigin, 1, 0xdc2626, 0.16, 0.08);
    const buoyancyArrow = new THREE.ArrowHelper(zeroDir, zeroOrigin, 1, 0x059669, 0.16, 0.08);
    const velocityArrow = new THREE.ArrowHelper(zeroDir, zeroOrigin, 1, 0x0284c7, 0.16, 0.08);
    gravityArrow.visible = false;
    buoyancyArrow.visible = false;
    velocityArrow.visible = false;
    scene.add(gravityArrow, buoyancyArrow, velocityArrow);

    // Rigid-Body Mesh Registry
    const bodyMeshes = new Map<number, BodyMeshRecord>();
    const activeBodyIds = new Set<number>();

    // Pointer Interaction & Raycasting
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const _planeHit = new THREE.Vector3();
    let activeDragMode: 'none' | 'body' | 'pour' | 'ruler' | 'scale' = 'none';
    const instrumentOffsetPx: Vec2 = { x: 0, y: 0 };

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const raycastTankPlane = (): Vec2 | null => {
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.ray.intersectPlane(zPlane, _planeHit);
      if (!hit) return null;
      return world3DToPx(hit.x, hit.y);
    };

    const onPointerDown = (e: PointerEvent) => {
      const world = worldRef.current;
      if (!world || e.button !== 0) return;

      updatePointerNdc(e.clientX, e.clientY);
      const tool = activeToolRef.current;

      // Check 3D instruments (ruler / spring scale) first when in select mode
      if (tool === 'select') {
        raycaster.setFromCamera(pointerNdc, camera);
        if (world.config.showRuler && rulerGroup.visible) {
          const rHits = raycaster.intersectObject(rulerGroup, true);
          if (rHits.length > 0) {
            const pt = raycastTankPlane();
            if (pt) {
              activeDragMode = 'ruler';
              controls.enabled = false;
              instrumentOffsetPx.x = pt.x - world.ruler.x;
              instrumentOffsetPx.y = pt.y - world.ruler.y;
              renderer.domElement.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
        if (world.config.showScale && scaleGroup.visible) {
          const sHits = raycaster.intersectObject(scaleGroup, true);
          if (sHits.length > 0) {
            const pt = raycastTankPlane();
            if (pt) {
              activeDragMode = 'scale';
              controls.enabled = false;
              instrumentOffsetPx.x = pt.x - world.scale.x;
              instrumentOffsetPx.y = pt.y - world.scale.y;
              renderer.domElement.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
      }

      if (tool === 'pour-water') {
        const pt = raycastTankPlane();
        if (pt) {
          activeDragMode = 'pour';
          controls.enabled = false;
          world.pourWaterAt(pt.x, pt.y);
          renderer.domElement.setPointerCapture(e.pointerId);
        }
        return;
      }

      if (
        tool === 'spawn-box' ||
        tool === 'spawn-circle' ||
        tool === 'spawn-ramp' ||
        tool === 'spawn-polygon'
      ) {
        const pt = raycastTankPlane();
        if (pt) {
          const shape: ShapeKind =
            tool === 'spawn-box'
              ? 'box'
              : tool === 'spawn-circle'
              ? 'circle'
              : tool === 'spawn-ramp'
              ? 'ramp'
              : 'polygon';
          world.spawnInteractiveShape(
            shape,
            pt.x,
            pt.y,
            shape === 'ramp' ? 'aluminum' : spawnMaterialRef.current
          );
          onSelectToolRef.current('select');
          onSyncUiRef.current();
        }
        return;
      }

      // Select & drag rigid bodies on raycast hit (leaves background orbit free!)
      raycaster.setFromCamera(pointerNdc, camera);
      const meshRoots = Array.from(bodyMeshes.values()).map((r) => r.group);
      const hits = raycaster.intersectObjects(meshRoots, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        let hitBodyId: number | null = null;
        while (obj) {
          if (typeof obj.userData.bodyId === 'number') {
            hitBodyId = obj.userData.bodyId;
            break;
          }
          obj = obj.parent;
        }
        if (hitBodyId !== null) {
          const pt = raycastTankPlane();
          if (pt) {
            world.selectedBodyId = hitBodyId;
            const hitBody = world.findBody(hitBodyId);
            if (hitBody && !hitBody.isStatic) {
              activeDragMode = 'body';
              controls.enabled = false;
              world.startDrag(pt, !isRunningRef.current);
              renderer.domElement.setPointerCapture(e.pointerId);
            }
            onSyncUiRef.current();
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const world = worldRef.current;
      if (!world || activeDragMode === 'none') return;
      updatePointerNdc(e.clientX, e.clientY);
      const pt = raycastTankPlane();
      if (!pt) return;

      if (activeDragMode === 'pour') {
        world.pourWaterAt(pt.x, pt.y);
      } else if (activeDragMode === 'ruler') {
        world.ruler.x = pt.x - instrumentOffsetPx.x;
        world.ruler.y = pt.y - instrumentOffsetPx.y;
      } else if (activeDragMode === 'scale') {
        world.moveScale(pt.x - instrumentOffsetPx.x, pt.y - instrumentOffsetPx.y);
      } else if (activeDragMode === 'body') {
        world.moveDrag(pt, !isRunningRef.current);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const world = worldRef.current;
      if (activeDragMode === 'body' && world) {
        const draggedId = world.selectedBodyId;
        world.endDrag();
        if (world.config.showScale && draggedId !== null) {
          const body = world.findBody(draggedId);
          const hookPt = world.getScaleHookPoint();
          if (
            body &&
            !body.isStatic &&
            Math.hypot(body.position.x - hookPt.x, body.position.y - hookPt.y) <= 44
          ) {
            world.attachScaleToBody(draggedId);
          }
        }
        onSyncUiRef.current();
      }
      activeDragMode = 'none';
      controls.enabled = true;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    // ResizeObserver for crisp viewport sizing
    const handleResize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Scratch vectors (zero GC in render loop)
    const _vDir = new THREE.Vector3();
    const _vPos = new THREE.Vector3();
    let activeLightingKey: LightingPreset3D = lightingPresetRef.current;
    let activeQualityKey: RenderQuality3D = renderQualityRef.current;
    let lastFrameMs = performance.now();
    let elapsedSec = 0;
    let disposed = false;
    let rafId = 0;
    let timerId = 0;

    const applyLightingPreset = (presetKey: LightingPreset3D) => {
      const p = LIGHTING_PRESETS[presetKey];
      (scene.background as THREE.Color).setHex(p.bgHex);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(p.bgHex);
        scene.fog.density = p.fogDensity;
      }
      scene.environmentIntensity = p.envIntensity;
      renderer.toneMappingExposure = p.exposure;

      hemiLight.color.setHex(p.hemiSky);
      hemiLight.groundColor.setHex(p.hemiGround);
      hemiLight.intensity = p.hemiIntensity;

      keyLight.color.setHex(p.keyColor);
      keyLight.intensity = p.keyIntensity;
      keyLight.position.set(...p.keyPos);

      rimLight.color.setHex(p.rimColor);
      rimLight.intensity = p.rimIntensity;

      wallMat.color.setHex(p.backdropColor);
      waterSystem.setStudioTone(p.benchTint, p.floorTint);

      if (softboxLight) {
        softboxLight.color.setHex(p.softboxColor);
        softboxLight.intensity = p.softboxIntensity;
      }
    };

    const syncSceneAndRender = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
      lastFrameMs = now;
      if (isRunningRef.current) {
        elapsedSec += dt;
      }

      // Live lighting/quality switching without scene teardown
      if (lightingPresetRef.current !== activeLightingKey) {
        activeLightingKey = lightingPresetRef.current;
        applyLightingPreset(activeLightingKey);
      }
      if (renderQualityRef.current !== activeQualityKey && !isSoftwareGl) {
        activeQualityKey = renderQualityRef.current;
        const maxDpr = activeQualityKey === 'ultra' ? 2 : 1.25;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
        renderer.shadowMap.enabled = activeQualityKey === 'ultra';
      }

      // Smooth camera preset transition
      if (cameraTransitionRef.current.active) {
        const alpha = 1 - Math.exp(-7.5 * Math.max(dt, 1 / 60));
        camera.position.lerp(cameraTransitionRef.current.pos, alpha);
        controls.target.lerp(cameraTransitionRef.current.target, alpha);
        if (
          camera.position.distanceTo(cameraTransitionRef.current.pos) < 0.02 &&
          controls.target.distanceTo(cameraTransitionRef.current.target) < 0.02
        ) {
          camera.position.copy(cameraTransitionRef.current.pos);
          controls.target.copy(cameraTransitionRef.current.target);
          cameraTransitionRef.current.active = false;
        }
      }
      controls.update();

      const world = worldRef.current;
      if (world) {
        // 1. Sync dynamic water & tank
        waterSystem.update(world, elapsedSec);
        gridGroup.visible = world.config.showGrid;

        // 2. Sync rigid bodies
        const bodies = world.getDynamicBodies();
        activeBodyIds.clear();

        for (const body of bodies) {
          activeBodyIds.add(body.id);
          const meta = world.metaMap.get(body.id);
          if (!meta) continue;

          const existing = bodyMeshes.get(body.id);
          const needsRebuild =
            !existing ||
            Math.abs(existing.scale - meta.scale) > 0.001 ||
            existing.materialId !== meta.materialId;

          let record = existing;
          if (needsRebuild) {
            if (existing) {
              scene.remove(existing.group);
              disposeObject3D(existing.group);
            }
            const group = buildCompositeBodyMesh(
              body,
              meta,
              textures,
              isSoftwareGl,
              castShadows
            );
            scene.add(group);
            record = {
              group,
              scale: meta.scale,
              materialId: meta.materialId,
              shape: meta.shape,
              isStatic: body.isStatic,
            };
            bodyMeshes.set(body.id, record);
          }

          if (record) {
            const p = pxTo3D(body.position);
            record.group.position.set(p.x, p.y, 0);
            record.group.rotation.z = -body.angle;

            const halo = record.group.getObjectByName('selection-halo');
            if (halo) {
              halo.visible = body.id === world.selectedBodyId;
            }
          }
        }

        // Remove deleted bodies
        for (const [id, rec] of bodyMeshes.entries()) {
          if (!activeBodyIds.has(id)) {
            scene.remove(rec.group);
            disposeObject3D(rec.group);
            bodyMeshes.delete(id);
          }
        }

        // 3. Sync 3D Force & Velocity Vector Arrows on selected body
        const selBody =
          world.selectedBodyId !== null ? world.findBody(world.selectedBodyId) : null;
        const selMeta =
          world.selectedBodyId !== null ? world.metaMap.get(world.selectedBodyId) : null;

        if (selBody && selMeta && !selBody.isStatic) {
          const pos3 = pxTo3D(selBody.position);
          _vPos.set(pos3.x, pos3.y, 0.45);

          if (world.config.showForceVectors) {
            const fgLen = Math.min(1.45, Math.max(0.24, selMeta.lastGravityN * 0.008));
            gravityArrow.position.copy(_vPos);
            _vDir.set(0, -1, 0);
            gravityArrow.setDirection(_vDir);
            gravityArrow.setLength(fgLen, 0.16, 0.08);
            gravityArrow.visible = true;

            if (selMeta.lastBuoyancyN > 0.2) {
              const fbLen = Math.min(1.45, Math.max(0.24, selMeta.lastBuoyancyN * 0.008));
              buoyancyArrow.position.set(pos3.x + 0.09, pos3.y, 0.45);
              _vDir.set(0, 1, 0);
              buoyancyArrow.setDirection(_vDir);
              buoyancyArrow.setLength(fbLen, 0.16, 0.08);
              buoyancyArrow.visible = true;
            } else {
              buoyancyArrow.visible = false;
            }
          } else {
            gravityArrow.visible = false;
            buoyancyArrow.visible = false;
          }

          if (world.config.showVelocityVector) {
            const v = selMeta.lastVelocityMs;
            const speed = Math.hypot(v.x, v.y);
            if (speed > 0.05) {
              const vLen = Math.min(1.4, Math.max(0.25, speed * 0.32));
              velocityArrow.position.set(pos3.x, pos3.y, 0.49);
              _vDir.set(v.x / speed, -v.y / speed, 0).normalize();
              velocityArrow.setDirection(_vDir);
              velocityArrow.setLength(vLen, 0.15, 0.07);
              velocityArrow.visible = true;
            } else {
              velocityArrow.visible = false;
            }
          } else {
            velocityArrow.visible = false;
          }
        } else {
          gravityArrow.visible = false;
          buoyancyArrow.visible = false;
          velocityArrow.visible = false;
        }

        // 4. Sync 3D Metric Ruler
        if (world.config.showRuler) {
          const rPos = pxTo3D({ x: world.ruler.x, y: world.ruler.y });
          rulerGroup.position.set(rPos.x, rPos.y, TANK_DEPTH_3D * 0.5 + 0.12);
          rulerGroup.rotation.z = -world.ruler.angleRad;
          rulerGroup.visible = true;
        } else {
          rulerGroup.visible = false;
        }

        // 5. Sync 3D Spring Scale
        if (world.config.showScale) {
          const sPos = pxTo3D({ x: world.scale.x, y: world.scale.y });
          scaleGroup.position.set(sPos.x, sPos.y, 0);
          const cordAttr = cordGeo.attributes.position as THREE.BufferAttribute;
          const attached =
            world.scale.attachedBodyId !== null
              ? world.findBody(world.scale.attachedBodyId)
              : null;
          if (attached) {
            const bPos = pxTo3D(attached.position);
            cordAttr.setXYZ(0, 0, -0.34, 0);
            cordAttr.setXYZ(1, bPos.x - sPos.x, bPos.y - sPos.y, 0);
            scaleCord.visible = true;
          } else {
            scaleCord.visible = false;
          }
          cordAttr.needsUpdate = true;
          scaleGroup.visible = true;
        } else {
          scaleGroup.visible = false;
        }
      }

      renderer.render(scene, camera);
    };

    // Yielding draw scheduler for SwiftShader vs smooth 60 FPS rAF for hardware GPU
    const rawGl = renderer.getContext() as WebGL2RenderingContext;
    const afterDraw = (done: () => void) => {
      if (isSoftwareGl && typeof rawGl.fenceSync === 'function') {
        const fence = rawGl.fenceSync(rawGl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        rawGl.flush();
        const poll = () => {
          if (disposed || !fence) return;
          const status = rawGl.clientWaitSync(fence, 0, 0);
          if (status === rawGl.WAIT_FAILED || status !== rawGl.TIMEOUT_EXPIRED) {
            rawGl.deleteSync(fence);
            timerId = window.setTimeout(done, 70);
          } else {
            timerId = window.setTimeout(poll, 16);
          }
        };
        timerId = window.setTimeout(poll, 16);
      } else {
        rafId = requestAnimationFrame(done);
      }
    };

    const loop = () => {
      if (disposed) return;
      syncSceneAndRender();
      afterDraw(loop);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', cancelTransition);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);

      for (const rec of bodyMeshes.values()) {
        scene.remove(rec.group);
        disposeObject3D(rec.group);
      }
      bodyMeshes.clear();

      waterSystem.dispose();
      textures.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();

      wallGeo.dispose();
      wallMat.dispose();
      gridGeo.dispose();
      gridMat.dispose();
      rulerGeo.dispose();
      rulerMat.dispose();
      tickGeo.dispose();
      tickMat.dispose();
      scaleHousingGeo.dispose();
      scaleHousingMat.dispose();
      scaleDialGeo.dispose();
      scaleDialMat.dispose();
      scaleHookGeo.dispose();
      scaleHookMat.dispose();
      cordGeo.dispose();
      cordMat.dispose();
      gravityArrow.dispose();
      buoyancyArrow.dispose();
      velocityArrow.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [worldRef]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-200 shadow-xs">
      <div ref={mountRef} className="h-full w-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 text-sm font-semibold text-white">
          در حال بازیابی موتور گرافیکی سه‌بعدی...
        </div>
      )}
    </div>
  );
}
