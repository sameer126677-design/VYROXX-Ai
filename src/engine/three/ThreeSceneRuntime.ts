import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  AnimationScenePlan,
  Camera3DSpec,
  resolveSceneVisualStyle,
  resolveVolumetricRaysIntensity,
  Scene3DConfig,
  SceneElement,
  SceneSegment,
  VisualStyle,
} from '../../shared/sceneSchema';
import {
  createGrassTerrainTexture,
  createLightShaftTexture,
  createRoomEnvMap,
  createSeededRng,
  createSoftParticleTexture,
  createStudioFloorTexture,
  detectSoftwareGl,
  disposeObject3D,
  hashSeed,
} from './materials';
import {
  animateCharacterRig,
  BuildingDoorwayInfo,
  CharacterJointRig,
  DroneRigData,
  PlanetRigData,
  ProductRigData,
  VehicleRigData,
} from './models';
import {
  evaluateCameraRig,
  frameCameraForBoundingBox,
  frameCustomCloseUpCamera,
  frameCustomEstablishingCamera,
  frameCustomFocusEndCamera,
  ProjectedPoint2D,
  projectWorldPoint,
  resolveCustomFocusPart,
  ResolvedCustomFocusPart,
} from './cameraRig';
import { buildObjectForElement, ObjectBuildContext } from './objectRegistry';
import { evaluatePhysicsState } from './physics';
import {
  applyVisualStyleToObject,
  updateShaderUniformsInObject,
} from './styleRegistry';
import { ExternalAssetRigData } from './assetLoader';
import {
  animateCustomModel,
  createCustomModelGroup,
  disposeCustomModel,
} from './customModel';

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _vecD = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredCamTarget = new THREE.Vector3();
const _box = new THREE.Box3();
const _focusBox = new THREE.Box3();
const _focusCenter = new THREE.Vector3();

function isDevLoggingEnabled(): boolean {
  return Boolean(import.meta.env && import.meta.env.DEV);
}

function fmtVec(v: { x: number; y: number; z: number }): string {
  return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
}

interface CustomSubjectCameraPlan {
  segmentId: string;
  customElementId: string;
  aiFocusPartId: string | undefined;
  matchedAiFocusPart: boolean;
  resolvedFocusPartId: string;
  resolutionSource: ResolvedCustomFocusPart['source'];
  focusPartObject: THREE.Object3D;
  subjectObject: THREE.Object3D;
  subjectBasePos: THREE.Vector3;
  initialFocusCenter: THREE.Vector3;
  startPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  startDistance: number;
  endPosition: THREE.Vector3;
  endTarget: THREE.Vector3;
  endDistance: number;
  partSize: number;
  dollyStartFraction: number;
  dollyEndFraction: number;
  fov: number;
  loggedFramePath: boolean;
}

interface TrackedElementInstance {
  element: SceneElement;
  object: THREE.Group;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  baseScale: THREE.Vector3;
}

interface WeatherSystem {
  points: THREE.Points;
  velocities: Float32Array;
  basePositions: Float32Array;
  spreadX: number;
  spreadY: number;
  spreadZ: number;
}

interface LightShaftInstance {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  baseRotZ: number;
  baseRotX: number;
  baseOpacity: number;
  speed: number;
  phase: number;
}

interface CausticLightInstance {
  light: THREE.PointLight;
  basePos: THREE.Vector3;
  baseIntensity: number;
  driftRadius: number;
  speedX: number;
  speedZ: number;
  pulseSpeed: number;
  phase: number;
}

function isUnderwaterSegment(plan: AnimationScenePlan, seg: SceneSegment): boolean {
  const text = [
    plan.title,
    plan.summary,
    seg.title,
    plan.visualContinuity?.environmentRules ?? '',
    plan.visualContinuity?.lightingStyle ?? '',
    ...seg.elements.map((e) => `${e.label} ${e.customModelSpec?.description ?? ''}`),
  ].join(' ');
  return /\b(underwater|ocean|deep[- ]?sea|abyss|abyssal|submerged|marine|whale|shark|reef|coral|dolphin|submarine|seafloor|seabed)\b/i.test(
    text
  );
}

export interface InspectedElementSnapshot {
  id: string;
  kind: string;
  label: string;
  worldPosition: { x: number; y: number; z: number };
  rotationYDeg: number;
  boundingBoxMin: { x: number; y: number; z: number };
  boundingBoxMax: { x: number; y: number; z: number };
  meshCount: number;
  instancedTotalCount: number;
  outlineMeshCount: number;
  materialTypes: string[];
  hasFlatShading: boolean;
  hasShaderMaterial: boolean;
  shaderTimeUniform: number | null;
  projected: ProjectedPoint2D;
  jointSample?: {
    leftHipX: number;
    rightHipX: number;
    leftKneeX: number;
    leftShoulderX: number;
    pelvisY: number;
  };
  doorwayInfo?: Omit<BuildingDoorwayInfo, 'doorPivot'>;
}

export interface InspectedSceneSnapshot {
  timeSec: number;
  sceneId: string;
  visualStyle: VisualStyle;
  environment: string;
  cameraType: 'perspective' | 'orthographic';
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  cameraFov: number;
  hasFog: boolean;
  fogDensity: number;
  hasEnvMap: boolean;
  lightCount: number;
  shadowCastingLightCount: number;
  elements: InspectedElementSnapshot[];
}

export interface ThreeSceneRuntimeOptions {
  fetchProtectedAssetBytes?: (storagePath: string) => Promise<ArrayBuffer>;
}

export class ThreeSceneRuntime {
  public readonly scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer | null = null;
  public controls: OrbitControls | null = null;
  public isSoftwareGl = false;

  private plan: AnimationScenePlan;
  private width: number;
  private height: number;
  private activeSegmentIndex = -1;
  private sceneContentGroup: THREE.Group;
  private trackedElements: TrackedElementInstance[] = [];
  private weatherSystem: WeatherSystem | null = null;
  private lightShafts: LightShaftInstance[] = [];
  private causticLights: CausticLightInstance[] = [];
  private currentTarget = new THREE.Vector3(0, 1, 0);
  private envPmrem: THREE.PMREMGenerator | null = null;
  private envTexture: THREE.Texture | null = null;
  private interactiveOrbit = false;
  private lastTimeSec = 0;
  private activeCamera3d: Camera3DSpec | null = null;
  private activeCustomDolly: CustomSubjectCameraPlan | null = null;
  private loggedNonCustomCameraPath = false;
  private fetchProtectedAssetBytes?: (storagePath: string) => Promise<ArrayBuffer>;

  constructor(
    plan: AnimationScenePlan,
    width?: number,
    height?: number,
    options?: ThreeSceneRuntimeOptions
  ) {
    this.plan = plan;
    this.width = Math.max(128, width ?? plan.width ?? 1280);
    this.height = Math.max(128, height ?? plan.height ?? 720);
    this.fetchProtectedAssetBytes = options?.fetchProtectedAssetBytes;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.width / this.height,
      0.1,
      800
    );
    this.sceneContentGroup = new THREE.Group();
    this.sceneContentGroup.name = 'vyroxx_scene_root';
    this.scene.add(this.sceneContentGroup);

    this.buildSegment(0);
    this.seekTime(0);
  }

  public attachRenderer(
    canvas: HTMLCanvasElement,
    options?: { preserveDrawingBuffer?: boolean; alpha?: boolean; enableOrbitControls?: boolean }
  ): void {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: options?.alpha ?? true,
      preserveDrawingBuffer: options?.preserveDrawingBuffer ?? false,
      powerPreference: 'high-performance',
    });

    this.isSoftwareGl = detectSoftwareGl(renderer);
    const dpr =
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(dpr, 2));
    renderer.setSize(this.width, this.height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const { texture, pmrem } = createRoomEnvMap(renderer);
    this.envTexture = texture;
    this.envPmrem = pmrem;
    this.scene.environment = texture;

    this.renderer = renderer;

    if (options?.enableOrbitControls) {
      this.controls = new OrbitControls(this.camera, renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.enabled = this.interactiveOrbit;
      this.controls.target.copy(this.currentTarget);
    }

    // Rebuild current segment with WebGL anisotropy & background settings
    const idx = Math.max(0, this.activeSegmentIndex);
    this.activeSegmentIndex = -1;
    this.buildSegment(idx);
    this.seekTime(this.lastTimeSec);
  }

  public setInteractiveOrbit(enabled: boolean): void {
    this.interactiveOrbit = enabled;
    if (this.controls) {
      this.controls.enabled = enabled;
      if (enabled) {
        this.controls.target.copy(this.currentTarget);
        this.controls.update();
      }
    }
  }

  public updatePlan(nextPlan: AnimationScenePlan): void {
    this.plan = nextPlan;
    this.activeSegmentIndex = -1;
    this.buildSegment(0);
    this.seekTime(0);
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(128, width);
    this.height = Math.max(128, height);
    const aspect = this.width / this.height;
    if ((this.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const p = this.camera as THREE.PerspectiveCamera;
      p.aspect = aspect;
      p.updateProjectionMatrix();
    } else {
      const o = this.camera as THREE.OrthographicCamera;
      const halfH = 12;
      o.left = -halfH * aspect;
      o.right = halfH * aspect;
      o.top = halfH;
      o.bottom = -halfH;
      o.updateProjectionMatrix();
    }
    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
    }
  }

  private resolveSegmentAtTime(tSec: number): {
    segmentIndex: number;
    segment: SceneSegment;
    localTimeSec: number;
  } {
    const scenes = this.plan.scenes;
    const total = Math.max(
      0.1,
      scenes.reduce((acc, s) => acc + Math.max(0.5, s.durationSec), 0)
    );
    const wrapped = ((tSec % total) + total) % total;
    let cursor = 0;
    for (let i = 0; i < scenes.length; i++) {
      const dur = Math.max(0.5, scenes[i].durationSec);
      if (wrapped <= cursor + dur || i === scenes.length - 1) {
        return {
          segmentIndex: i,
          segment: scenes[i],
          localTimeSec: Math.max(0, wrapped - cursor),
        };
      }
      cursor += dur;
    }
    return { segmentIndex: 0, segment: scenes[0], localTimeSec: 0 };
  }

  private buildSegment(segmentIndex: number): void {
    if (this.activeSegmentIndex === segmentIndex) return;
    const seg = this.plan.scenes[segmentIndex] || this.plan.scenes[0];
    if (!seg) return;

    this.activeSegmentIndex = segmentIndex;
    this.trackedElements = [];
    this.weatherSystem = null;
    this.lightShafts = [];
    this.causticLights = [];
    this.activeCustomDolly = null;
    this.loggedNonCustomCameraPath = false;

    // Cleanly dispose previous segment GPU assets
    while (this.sceneContentGroup.children.length > 0) {
      const child = this.sceneContentGroup.children[0];
      this.sceneContentGroup.remove(child);
      if (child instanceof THREE.Group && child.userData?.rig?.type === 'custom') {
        disposeCustomModel(child);
      } else {
        disposeObject3D(child);
      }
    }

    const s3d = seg.scene3d;
    const aspect = this.width / this.height;
    const camCfg = s3d?.camera3d;

    // Configure Perspective vs Orthographic Camera
    if (camCfg?.projection === 'orthographic') {
      const halfH = 14;
      const ortho = new THREE.OrthographicCamera(
        -halfH * aspect,
        halfH * aspect,
        halfH,
        -halfH,
        0.1,
        800
      );
      this.camera = ortho;
    } else {
      this.camera = new THREE.PerspectiveCamera(
        camCfg?.fov ?? 52,
        aspect,
        0.1,
        800
      );
    }
    if (this.controls) {
      this.controls.object = this.camera;
    }

    const underwater = isUnderwaterSegment(this.plan, seg);

    // Background & True Vertical Gradient (skyTop -> skyBottom)
    const bgMode = seg.background?.mode || 'scene';
    if (bgMode === 'transparent') {
      this.scene.background = null;
      if (this.renderer) this.renderer.setClearAlpha(0);
    } else if (bgMode === 'solid') {
      this.scene.background = new THREE.Color(seg.background.solidColor || '#050814');
      if (this.renderer) this.renderer.setClearAlpha(1);
    } else {
      const topHex = seg.background.skyTop || (underwater ? '#0c4a6e' : '#020617');
      const bottomHex = seg.background.skyBottom || (underwater ? '#020c1b' : '#0f172a');
      this.scene.background = new THREE.Color(bottomHex);
      if (this.renderer) this.renderer.setClearAlpha(1);
      const skyGeo = new THREE.PlaneGeometry(2, 2);
      const skyMat = new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(topHex) },
          bottomColor: { value: new THREE.Color(bottomHex) },
          horizonColor: { value: new THREE.Color(seg.background.horizonColor || bottomHex) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.9999, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec2 vUv;
          void main() {
            float t = smoothstep(0.0, 1.0, clamp(vUv.y, 0.0, 1.0));
            vec3 col = mix(bottomColor, topColor, t);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      const skyDome = new THREE.Mesh(skyGeo, skyMat);
      skyDome.name = 'sky_dome';
      skyDome.frustumCulled = false;
      skyDome.renderOrder = -1000;
      skyDome.userData.skipOutline = true;
      this.sceneContentGroup.add(skyDome);
    }

    // Exponential Volumetric Atmospheric Fog (blue-green default for underwater scenes)
    const rawFogDensity = s3d?.fogDensity;
    const fogDensity =
      rawFogDensity !== undefined && rawFogDensity > 0.0005
        ? rawFogDensity
        : underwater
        ? 0.022
        : seg.weather.type === 'fog'
        ? 0.024
        : 0.006;
    if (fogDensity > 0.0005 && bgMode === 'scene' && s3d?.environment !== 'space') {
      const fogHex =
        s3d?.fogColor ||
        (underwater ? '#0a4254' : seg.background.horizonColor || '#1e293b');
      this.scene.fog = new THREE.FogExp2(fogHex, fogDensity);
    } else {
      this.scene.fog = null;
    }

    // 3-Point + Hemisphere + Directional Shadow Lighting
    const hemi = new THREE.HemisphereLight(
      seg.background.skyBottom || '#94a3b8',
      seg.background.groundColor || '#1e293b',
      s3d?.ambientIntensity ?? 0.75
    );
    this.sceneContentGroup.add(hemi);

    const sunElev = THREE.MathUtils.degToRad(s3d?.sunElevationDeg ?? 42);
    const sunAzim = THREE.MathUtils.degToRad(s3d?.sunAzimuthDeg ?? 35);
    const sunDist = 75;
    const sunLight = new THREE.DirectionalLight(
      seg.lighting.mood === 'golden-hour'
        ? '#fed7aa'
        : seg.lighting.mood === 'neon'
        ? '#e0f2fe'
        : '#ffffff',
      s3d?.sunIntensity ?? 1.9
    );
    sunLight.position.set(
      Math.cos(sunElev) * Math.sin(sunAzim) * sunDist,
      Math.sin(sunElev) * sunDist,
      Math.cos(sunElev) * Math.cos(sunAzim) * sunDist
    );
    sunLight.castShadow = !this.isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 200;
    const dShadow = 55;
    sunLight.shadow.camera.left = -dShadow;
    sunLight.shadow.camera.right = dShadow;
    sunLight.shadow.camera.top = dShadow;
    sunLight.shadow.camera.bottom = -dShadow;
    sunLight.shadow.bias = -0.0005;
    this.sceneContentGroup.add(sunLight);

    // Cinematic Rim / Accent Fill Light
    const rimLight = new THREE.DirectionalLight(
      seg.lighting.bloomColor || '#38bdf8',
      0.85
    );
    rimLight.position.set(-28, 16, -32);
    this.sceneContentGroup.add(rimLight);

    if (s3d?.environment === 'studio') {
      // Studio softbox overhead + warm side fill for product sheen
      const topSoftbox = new THREE.PointLight('#ffffff', 22, 40, 1.4);
      topSoftbox.position.set(0, 7.5, 2.5);
      const sideSoftbox = new THREE.PointLight('#bae6fd', 14, 35, 1.4);
      sideSoftbox.position.set(-6, 3.2, 4);
      this.sceneContentGroup.add(topSoftbox, sideSoftbox);
    }

    // Ground Surface
    const maxAniso = this.renderer
      ? this.renderer.capabilities.getMaxAnisotropy()
      : 4;
    const groundSize = s3d?.groundSize ?? 180;
    const groundType = s3d?.groundType ?? 'asphalt';
    if (groundType !== 'none' && bgMode !== 'transparent') {
      if (groundType === 'grid') {
        const grid = new THREE.GridHelper(
          groundSize,
          Math.round(groundSize / 4),
          seg.lighting.bloomColor || '#38bdf8',
          '#1e293b'
        );
        this.sceneContentGroup.add(grid);
      } else {
        const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
        let groundMat: THREE.MeshStandardMaterial;
        if (groundType === 'grass') {
          groundMat = new THREE.MeshStandardMaterial({
            map: createGrassTerrainTexture(
              seg.background.groundColor || '#14532d',
              '#22c55e',
              maxAniso
            ),
            roughness: 0.92,
            metalness: 0.02,
          });
        } else if (groundType === 'studio-floor') {
          groundMat = new THREE.MeshStandardMaterial({
            map: createStudioFloorTexture(seg.background.groundColor || '#090d16'),
            roughness: 0.25,
            metalness: 0.35,
          });
        } else {
          groundMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(seg.background.groundColor || '#0f172a'),
            roughness: groundType === 'asphalt' ? 0.72 : 0.9,
            metalness: groundType === 'asphalt' ? 0.14 : 0.04,
          });
        }
        const groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.receiveShadow = true;
        groundMesh.userData.skipOutline = true;
        groundMesh.name = 'ground_plane';
        const segStyle = resolveSceneVisualStyle(this.plan, seg);
        if (segStyle === 'anime-cel' || segStyle === 'low-poly') {
          applyVisualStyleToObject(groundMesh, segStyle);
        }
        this.sceneContentGroup.add(groundMesh);
      }
    }

    // Starfield for Space or Stars weather
    if (s3d?.environment === 'space' || seg.weather.type === 'stars') {
      this.buildStarfield();
    }

    // Weather Particle System (rain / snow / ash / sparks)
    if (
      seg.weather.type === 'rain' ||
      seg.weather.type === 'snow' ||
      seg.weather.type === 'ash' ||
      seg.weather.type === 'sparks'
    ) {
      this.buildWeatherParticles(seg);
    }

    const hasRoadElement = seg.elements.some((e) => e.kind === 'road');
    const visualStyle = resolveSceneVisualStyle(this.plan, seg);

    // Instantiate Every 3D Scene Element
    for (const el of seg.elements) {
      const obj = this.buildElement3D(el, {
        scene3d: s3d,
        visualStyle,
        hasRoad: hasRoadElement,
        maxAnisotropy: maxAniso,
        fetchProtectedAssetBytes: this.fetchProtectedAssetBytes,
      });
      if (!obj) continue;

      const basePos = new THREE.Vector3(
        el.pos3d?.x ?? (el.x - 0.5) * 28,
        el.pos3d?.y ?? 0,
        el.pos3d?.z ?? 12 - (1 - el.depth) * 48
      );
      const baseRot = new THREE.Euler(
        THREE.MathUtils.degToRad(el.rot3d?.x ?? 0),
        THREE.MathUtils.degToRad(el.rot3d?.y ?? el.rotationDeg ?? 0),
        THREE.MathUtils.degToRad(el.rot3d?.z ?? 0)
      );

      obj.position.copy(basePos);
      obj.rotation.copy(baseRot);
      this.sceneContentGroup.add(obj);

      this.trackedElements.push({
        element: el,
        object: obj,
        basePos,
        baseRot,
        baseScale: obj.scale.clone(),
      });
    }

    // Auto-frame camera from primary subject(s) bounding box/sphere
    this.activeCamera3d = s3d?.camera3d ?? null;
    const customTracked = this.trackedElements.filter(
      (t) => t.element.kind === 'custom'
    );

    if (customTracked.length > 0) {
      const cam = s3d?.camera3d;
      const fov = cam?.fov ?? 50;
      const aspect = this.width / this.height;
      const rawDir = cam
        ? new THREE.Vector3(
            cam.position.x - cam.target.x,
            cam.position.y - cam.target.y,
            cam.position.z - cam.target.z
          )
        : new THREE.Vector3();

      const subjectBox = new THREE.Box3();
      for (const item of customTracked) {
        item.object.updateMatrixWorld(true);
        _box.setFromObject(item.object);
        if (!_box.isEmpty()) {
          subjectBox.union(_box);
        }
      }

      if (!subjectBox.isEmpty()) {
        const primaryCustom = customTracked[0];
        const aiFocusPartId = primaryCustom.element.customModelSpec?.focusPartId;
        const subjectCenter = subjectBox.getCenter(new THREE.Vector3());

        // If AI specified a valid focusPartId, orient the 3/4 establishing camera on the same
        // lateral side of the head so the dolly glides straight in without crossing the body.
        let establishingHintDir: THREE.Vector3 | undefined =
          rawDir.lengthSq() > 0.01 ? rawDir : undefined;
        if (aiFocusPartId) {
          const matchedMesh = primaryCustom.object.getObjectByName(aiFocusPartId);
          if (matchedMesh && (matchedMesh as THREE.Mesh).isMesh) {
            matchedMesh.updateMatrixWorld(true);
            const preBox = new THREE.Box3().setFromObject(matchedMesh);
            if (!preBox.isEmpty()) {
              const preCenter = preBox.getCenter(new THREE.Vector3());
              const offX = preCenter.x - subjectCenter.x;
              const offZ = preCenter.z - subjectCenter.z;
              if (Math.hypot(offX, offZ) > 0.02) {
                establishingHintDir = new THREE.Vector3(
                  Math.abs(offX) > 0.02 ? Math.sign(offX) : (rawDir.x || 1),
                  0.28,
                  Math.abs(offZ) > 0.02 ? Math.sign(offZ) : (rawDir.z || 1)
                );
              }
            }
          }
        }

        const establishing = frameCustomEstablishingCamera(
          subjectBox,
          fov,
          aspect,
          {
            hintDirection: establishingHintDir,
            targetWidthFill: 0.5,
            angleFromLongestDeg: 60,
            elevationDeg: 16,
          }
        );

        const resolvedFocus = resolveCustomFocusPart(
          primaryCustom.object,
          aiFocusPartId,
          establishing.position
        );
        resolvedFocus.partObject.updateMatrixWorld(true);
        const focusPartBox = new THREE.Box3().setFromObject(resolvedFocus.partObject);

        const isExplicitCloseUpShot =
          cam?.shotType === 'close-up' || cam?.shotType === 'extreme-close-up';

        let startPosition: THREE.Vector3;
        let startTarget: THREE.Vector3;
        let startDistance: number;
        let endPosition: THREE.Vector3;
        let endTarget: THREE.Vector3;
        let endDistance: number;
        let partSize: number;
        let dollyStartFraction: number;

        if (isExplicitCloseUpShot) {
          const closeUp = frameCustomCloseUpCamera(
            subjectBox,
            focusPartBox,
            fov,
            aspect,
            {
              hintDirection: establishing.position.clone().sub(establishing.target),
              endDistanceMultiplier: 1.5,
            }
          );
          startPosition = closeUp.startPosition;
          startTarget = closeUp.target;
          startDistance = closeUp.startDistance;
          endPosition = closeUp.endPosition;
          endTarget = closeUp.endTarget;
          endDistance = closeUp.endDistance;
          partSize = closeUp.partSize;
          dollyStartFraction = 0.0;
        } else {
          const endFrame = frameCustomFocusEndCamera(
            subjectBox,
            focusPartBox,
            establishing.position,
            { endDistanceMultiplier: 1.5 }
          );
          startPosition = establishing.position;
          startTarget = establishing.target;
          startDistance = establishing.distance;
          endPosition = endFrame.position;
          endTarget = endFrame.target;
          endDistance = endFrame.distance;
          partSize = endFrame.partSize;
          // Hold 3/4 establishing shot for first 40%, then smooth ease-in-out dolly during last 60%
          dollyStartFraction = 0.4;
        }

        this.activeCustomDolly = {
          segmentId: seg.id,
          customElementId: primaryCustom.element.id,
          aiFocusPartId,
          matchedAiFocusPart: resolvedFocus.matchedAiFocusPart,
          resolvedFocusPartId: resolvedFocus.partId,
          resolutionSource: resolvedFocus.source,
          focusPartObject: resolvedFocus.partObject,
          subjectObject: primaryCustom.object,
          subjectBasePos: primaryCustom.basePos.clone(),
          initialFocusCenter: endTarget.clone(),
          startPosition: startPosition.clone(),
          startTarget: startTarget.clone(),
          startDistance,
          endPosition: endPosition.clone(),
          endTarget: endTarget.clone(),
          endDistance,
          partSize,
          dollyStartFraction,
          dollyEndFraction: 1.0,
          fov,
          loggedFramePath: false,
        };

        if ((this.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
          const pCam = this.camera as THREE.PerspectiveCamera;
          pCam.fov = fov;
          pCam.near = Math.min(0.05, Math.max(0.005, endDistance * 0.08));
          pCam.far = Math.max(800, startDistance * 10);
          pCam.updateProjectionMatrix();
        }

        if (isDevLoggingEnabled()) {
          console.log('[VYROXX CameraDiag:buildSegment]', {
            segmentId: seg.id,
            hasCustomSubject: true,
            customElementId: primaryCustom.element.id,
            aiShotType: cam?.shotType ?? 'none',
            aiMotion: cam?.motion ?? 'none',
            aiFocusPartId: aiFocusPartId ?? null,
            matchedAiFocusPart: resolvedFocus.matchedAiFocusPart,
            resolvedFocusPartId: resolvedFocus.partId,
            resolutionSource: resolvedFocus.source,
            startPosition: fmtVec(startPosition),
            startDistance: Number(startDistance.toFixed(3)),
            endPosition: fmtVec(endPosition),
            endDistance: Number(endDistance.toFixed(3)),
            focusPartSize: Number(partSize.toFixed(3)),
            dollyWindow: `${Math.round(dollyStartFraction * 100)}%->100%`,
          });
        }
      }
    } else if (this.trackedElements.length > 0 && s3d?.camera3d) {
      const cam = s3d.camera3d;
      const hasDistinctEndPos =
        Boolean(cam.endPosition) &&
        Math.hypot(
          (cam.endPosition?.x ?? cam.position.x) - cam.position.x,
          (cam.endPosition?.y ?? cam.position.y) - cam.position.y,
          (cam.endPosition?.z ?? cam.position.z) - cam.position.z
        ) > 0.05;
      const rawDir = new THREE.Vector3(
        cam.position.x - cam.target.x,
        cam.position.y - cam.target.y,
        cam.position.z - cam.target.z
      );

      if (isDevLoggingEnabled()) {
        console.log('[VYROXX CameraDiag:buildSegment]', {
          segmentId: seg.id,
          hasCustomSubject: false,
          aiFocusPartId: null,
          matchedAiFocusPart: false,
          aiShotType: cam.shotType,
          aiMotion: cam.motion,
        });
      }

      {
        const PRIMARY_ACTOR_KINDS = new Set([
          'custom',
          'character',
          'creature',
          'vehicle',
          'product',
          'drone',
          'planet',
          'external-asset',
          'procedural-mesh',
          'shader-fx',
        ]);
        const DECOR_KINDS = new Set([
          'skyline',
          'mountains',
          'trees',
          'clouds',
          'sun-moon',
          'road',
          'grid-floor',
          'text',
          'chart',
          'logo',
        ]);

        const primaryActors = this.trackedElements.filter((t) =>
          PRIMARY_ACTOR_KINDS.has(t.element.kind)
        );
        const buildings = this.trackedElements.filter(
          (t) => t.element.kind === 'building'
        );
        const fallbackProps = this.trackedElements.filter(
          (t) => !DECOR_KINDS.has(t.element.kind) && t.element.kind !== 'building'
        );
        const subjectTracked =
          primaryActors.length > 0
            ? primaryActors
            : buildings.length > 0
            ? buildings
            : fallbackProps;

        if (
          subjectTracked.length > 0 &&
          (!hasDistinctEndPos || cam.motion === 'static' || cam.motion === 'orbit') &&
          cam.motion !== 'follow-subject' &&
          cam.motion !== 'tracking' &&
          cam.motion !== 'flythrough'
        ) {
          const subjectBox = new THREE.Box3();
          for (const item of subjectTracked) {
            item.object.updateMatrixWorld(true);
            _box.setFromObject(item.object);
            if (!_box.isEmpty()) {
              subjectBox.union(_box);
            }
          }

          if (!subjectBox.isEmpty()) {
            // Measure current fill so deliberately well-framed orbit/low-angle shots stay untouched
            let shouldReframe = true;
            if (cam.shotType === 'orbit' || cam.motion === 'orbit' || cam.shotType === 'low-angle') {
              this.camera.position.set(cam.position.x, cam.position.y, cam.position.z);
              this.camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
              this.camera.updateMatrixWorld(true);
              const corners = [
                new THREE.Vector3(subjectBox.min.x, subjectBox.min.y, subjectBox.min.z),
                new THREE.Vector3(subjectBox.min.x, subjectBox.min.y, subjectBox.max.z),
                new THREE.Vector3(subjectBox.min.x, subjectBox.max.y, subjectBox.min.z),
                new THREE.Vector3(subjectBox.min.x, subjectBox.max.y, subjectBox.max.z),
                new THREE.Vector3(subjectBox.max.x, subjectBox.min.y, subjectBox.min.z),
                new THREE.Vector3(subjectBox.max.x, subjectBox.min.y, subjectBox.max.z),
                new THREE.Vector3(subjectBox.max.x, subjectBox.max.y, subjectBox.min.z),
                new THREE.Vector3(subjectBox.max.x, subjectBox.max.y, subjectBox.max.z),
              ];
              let minX = Infinity;
              let maxX = -Infinity;
              let minY = Infinity;
              let maxY = -Infinity;
              let allInFront = true;
              for (const c of corners) {
                const p = c.project(this.camera);
                if (p.z < -1 || p.z > 1) allInFront = false;
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
              }
              const curFill = Math.max((maxX - minX) * 0.5, (maxY - minY) * 0.5);
              if (allInFront && curFill >= 0.3 && curFill <= 1.15) {
                shouldReframe = false;
              }
            }

            if (shouldReframe) {
              const targetFill =
                cam.shotType === 'extreme-close-up'
                  ? 0.78
                  : cam.shotType === 'close-up'
                  ? 0.66
                  : 0.54;
              const framed = frameCameraForBoundingBox(
                subjectBox,
                cam.fov,
                this.width / this.height,
                rawDir.lengthSq() > 0.01 ? rawDir : undefined,
                targetFill
              );
              const nextCam: Camera3DSpec = {
                ...cam,
                position: {
                  x: Number(framed.position.x.toFixed(3)),
                  y: Number(framed.position.y.toFixed(3)),
                  z: Number(framed.position.z.toFixed(3)),
                },
                target: {
                  x: Number(framed.target.x.toFixed(3)),
                  y: Number(framed.target.y.toFixed(3)),
                  z: Number(framed.target.z.toFixed(3)),
                },
                orbitRadius:
                  cam.motion === 'orbit'
                    ? Number(framed.distance.toFixed(3))
                    : cam.orbitRadius,
              };
              if (cam.motion === 'static') {
                delete nextCam.endPosition;
                delete nextCam.endTarget;
              }
              this.activeCamera3d = nextCam;
            }
          }
        }
      }
    }

    // Build deterministic atmospheric light shafts, caustic lights, and vignette overlay
    this.buildAtmosphereEffects(seg, s3d, bgMode, underwater);
  }

  private buildAtmosphereEffects(
    seg: SceneSegment,
    s3d: Scene3DConfig | undefined,
    bgMode: SceneSegment['background']['mode'],
    underwater: boolean
  ): void {
    if (bgMode === 'transparent') return;

    const volumetricIntensity = resolveVolumetricRaysIntensity(seg.lighting.volumetricRays);
    const isSpace = s3d?.environment === 'space';

    // Compute primary subject center and bounding radius so shafts & caustics scale cleanly
    const focusBox = new THREE.Box3();
    const primaryList =
      this.trackedElements.filter((t) => t.element.kind === 'custom').length > 0
        ? this.trackedElements.filter((t) => t.element.kind === 'custom')
        : this.trackedElements;
    for (const item of primaryList) {
      item.object.updateMatrixWorld(true);
      _box.setFromObject(item.object);
      if (!_box.isEmpty()) {
        focusBox.union(_box);
      }
    }
    const focusCenter = new THREE.Vector3(0, 1.5, 0);
    let focusRadius = 6;
    if (!focusBox.isEmpty()) {
      const sph = focusBox.getBoundingSphere(new THREE.Sphere());
      focusCenter.copy(sph.center);
      focusRadius = Math.max(1.5, Math.min(45, sph.radius));
    }

    // 1. Volumetric Light Shafts: 4 translucent additive tapered cones swaying slowly with time
    if (volumetricIntensity > 0.01 && !isSpace && bgMode === 'scene') {
      const shaftsGroup = new THREE.Group();
      shaftsGroup.name = 'volumetric_light_shafts';
      shaftsGroup.userData.skipOutline = true;

      const span = Math.max(4.5, focusRadius * 1.45);
      const shaftLen = span * 3.2;
      const shaftColor = new THREE.Color(
        underwater ? '#7dd3fc' : seg.lighting.bloomColor || '#bae6fd'
      );

      const specs = [
        { ox: -0.62, oz: -0.52, topR: 0.14, botR: 0.42, rotZ: -0.22, rotX: 0.08, speed: 0.42, phase: 0.0, op: 0.17 },
        { ox: -0.16, oz: -0.82, topR: 0.18, botR: 0.52, rotZ: -0.16, rotX: 0.05, speed: 0.35, phase: 1.55, op: 0.21 },
        { ox: 0.28, oz: -0.58, topR: 0.16, botR: 0.46, rotZ: -0.20, rotX: -0.06, speed: 0.48, phase: 3.1, op: 0.18 },
        { ox: 0.7, oz: -0.36, topR: 0.13, botR: 0.38, rotZ: -0.14, rotX: 0.09, speed: 0.38, phase: 4.65, op: 0.15 },
      ];

      for (let i = 0; i < specs.length; i++) {
        const sp = specs[i];
        const geo = new THREE.CylinderGeometry(
          sp.topR * span,
          sp.botR * span,
          shaftLen,
          16,
          1,
          true
        );
        const tex = createLightShaftTexture(64, 128);
        const baseOpacity = sp.op * volumetricIntensity;
        const mat = new THREE.MeshBasicMaterial({
          color: shaftColor,
          map: tex,
          transparent: true,
          opacity: baseOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        });
        const shaftMesh = new THREE.Mesh(geo, mat);
        shaftMesh.name = `light_shaft_${i + 1}`;
        shaftMesh.position.set(
          focusCenter.x + sp.ox * span,
          focusCenter.y + span * 0.72,
          focusCenter.z + sp.oz * span
        );
        shaftMesh.rotation.set(sp.rotX, 0, sp.rotZ);
        shaftMesh.renderOrder = 10;
        shaftMesh.userData.skipOutline = true;
        shaftsGroup.add(shaftMesh);

        this.lightShafts.push({
          mesh: shaftMesh,
          material: mat,
          baseRotZ: sp.rotZ,
          baseRotX: sp.rotX,
          baseOpacity,
          speed: sp.speed,
          phase: sp.phase,
        });
      }

      this.sceneContentGroup.add(shaftsGroup);
    }

    // 2. Subtle Moving Caustic Lighting (shadowless, software-GL safe, purely time-driven)
    if ((underwater || volumetricIntensity > 0.01) && !isSpace && bgMode === 'scene') {
      const causticHeight = Math.max(2.6, focusRadius * 1.15);
      const driftRadius = Math.max(1.8, focusRadius * 0.75);
      const lightRange = Math.max(22, focusRadius * 6.5);
      const baseStrength = (underwater ? 3.2 : 1.6) * Math.max(0.4, volumetricIntensity);

      const causticSpecs = [
        {
          name: 'caustic_light_1',
          color: underwater ? '#38bdf8' : seg.lighting.bloomColor || '#7dd3fc',
          ox: -driftRadius * 0.45,
          oz: driftRadius * 0.35,
          intensity: baseStrength,
          speedX: 0.85,
          speedZ: 0.65,
          pulseSpeed: 1.75,
          phase: 0.0,
        },
        {
          name: 'caustic_light_2',
          color: underwater ? '#2dd4bf' : '#bae6fd',
          ox: driftRadius * 0.5,
          oz: -driftRadius * 0.3,
          intensity: baseStrength * 0.82,
          speedX: 0.72,
          speedZ: 0.94,
          pulseSpeed: 1.48,
          phase: 1.9,
        },
      ];

      for (const cs of causticSpecs) {
        const pt = new THREE.PointLight(cs.color, cs.intensity, lightRange, 1.15);
        pt.name = cs.name;
        pt.castShadow = false;
        const basePos = new THREE.Vector3(
          focusCenter.x + cs.ox,
          focusCenter.y + causticHeight,
          focusCenter.z + cs.oz
        );
        pt.position.copy(basePos);
        this.sceneContentGroup.add(pt);
        this.causticLights.push({
          light: pt,
          basePos,
          baseIntensity: cs.intensity,
          driftRadius,
          speedX: cs.speedX,
          speedZ: cs.speedZ,
          pulseSpeed: cs.pulseSpeed,
          phase: cs.phase,
        });
      }
    }

    // 3. Lightweight Software-GL-safe Vignette Overlay (zero post-processing)
    const vignetteStrength = Math.max(0, Math.min(1, seg.lighting.vignette ?? 0));
    if (vignetteStrength > 0.01 && bgMode === 'scene') {
      const vigGeo = new THREE.PlaneGeometry(2, 2);
      const vigMat = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        uniforms: {
          uStrength: { value: vignetteStrength * 0.68 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uStrength;
          varying vec2 vUv;
          void main() {
            float dist = length((vUv - 0.5) * 2.0);
            float alpha = smoothstep(0.55, 1.42, dist) * uStrength;
            gl_FragColor = vec4(0.008, 0.024, 0.055, alpha);
          }
        `,
      });
      const vigMesh = new THREE.Mesh(vigGeo, vigMat);
      vigMesh.name = 'vignette_overlay';
      vigMesh.frustumCulled = false;
      vigMesh.renderOrder = 999;
      vigMesh.userData.skipOutline = true;
      this.sceneContentGroup.add(vigMesh);
    }
  }

  private buildElement3D(
    el: SceneElement,
    ctx: ObjectBuildContext
  ): THREE.Group | null {
    switch (el.kind) {
      case 'custom': {
        const group = createCustomModelGroup(el);
        applyVisualStyleToObject(group, ctx.visualStyle, {
          shaderSpec: el.shaderSpec,
        });
        return group;
      }
      default:
        return buildObjectForElement(el, ctx);
    }
  }

  private buildStarfield(): void {
    const rng = createSeededRng(104729);
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 110 + rng() * 140;
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#e2e8f0',
      size: 0.75,
      map: createSoftParticleTexture(64),
      transparent: true,
      opacity: 0.92,
      alphaTest: 0.01,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(geo, mat);
    stars.name = 'starfield';
    this.sceneContentGroup.add(stars);
  }

  private buildWeatherParticles(seg: SceneSegment): void {
    const type = seg.weather.type;
    const count = Math.round(180 + seg.weather.density * 520);
    const spreadX = 60;
    const spreadY = 32;
    const spreadZ = 60;

    const rng = createSeededRng(hashSeed(`weather:${seg.id}:${type}`));
    const positions = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const px = (rng() - 0.5) * spreadX;
      const py = rng() * spreadY;
      const pz = (rng() - 0.5) * spreadZ;
      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;
      basePositions[i * 3] = px;
      basePositions[i * 3 + 1] = py;
      basePositions[i * 3 + 2] = pz;

      velocities[i * 3] = seg.weather.windX * (type === 'rain' ? 6 : 2.5);
      velocities[i * 3 + 1] =
        type === 'rain'
          ? -(18 + rng() * 8)
          : type === 'sparks'
          ? 2 + rng() * 4
          : -(1.4 + rng() * 2.2);
      velocities[i * 3 + 2] = (rng() - 0.5) * 1.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const color =
      type === 'rain'
        ? '#bae6fd'
        : type === 'snow'
        ? '#f8fafc'
        : type === 'sparks'
        ? '#fb923c'
        : '#94a3b8';
    const mat = new THREE.PointsMaterial({
      color,
      size: type === 'rain' ? 0.16 : type === 'snow' ? 0.28 : type === 'ash' ? 0.24 : 0.22,
      map: createSoftParticleTexture(64),
      transparent: true,
      opacity: type === 'snow' || type === 'ash' ? 0.72 : 0.78,
      alphaTest: 0.01,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.name = `weather_${type}`;
    this.sceneContentGroup.add(points);
    this.weatherSystem = {
      points,
      velocities,
      basePositions,
      spreadX,
      spreadY,
      spreadZ,
    };
  }

  public seekTime(tSec: number, smoothDampDeltaSec?: number): void {
    const wrappedLoop = tSec < this.lastTimeSec - 0.5;
    this.lastTimeSec = tSec;

    const { segmentIndex, segment, localTimeSec } =
      this.resolveSegmentAtTime(tSec);
    this.buildSegment(segmentIndex);

    const segDur = Math.max(0.5, segment.durationSec);
    const normT = Math.max(0, Math.min(1, localTimeSec / segDur));

    for (const item of this.trackedElements) {
      const { element, object, basePos, baseRot, baseScale } = item;
      let isMoving = false;

      if (element.physicsSpec && element.physicsSpec.mode !== 'none') {
        const phys = evaluatePhysicsState(
          element.physicsSpec,
          { x: basePos.x, y: basePos.y, z: basePos.z },
          localTimeSec
        );
        object.position.set(phys.x, phys.y, phys.z);
        object.scale.set(
          baseScale.x * phys.scaleX,
          baseScale.y * phys.scaleY,
          baseScale.z * phys.scaleZ
        );
        object.rotation.set(
          baseRot.x + phys.rotX,
          baseRot.y,
          baseRot.z + phys.rotZ
        );
        isMoving = Math.abs(phys.vy) > 0.1 || element.physicsSpec.mode === 'orbit-gravity';
      } else if (element.path3d && element.path3d.length >= 2) {
        isMoving = true;
        object.scale.copy(baseScale);
        const kfs = element.path3d;
        let idx = 0;
        while (idx < kfs.length - 2 && normT > kfs[idx + 1].t) {
          idx++;
        }
        const a = kfs[idx];
        const b = kfs[idx + 1];
        const span = Math.max(0.0001, b.t - a.t);
        const alpha = Math.max(0, Math.min(1, (normT - a.t) / span));

        object.position.set(
          THREE.MathUtils.lerp(a.x, b.x, alpha),
          THREE.MathUtils.lerp(a.y, b.y, alpha),
          THREE.MathUtils.lerp(a.z, b.z, alpha)
        );

        if (a.rotY !== undefined && b.rotY !== undefined) {
          object.rotation.y = THREE.MathUtils.degToRad(
            THREE.MathUtils.lerp(a.rotY, b.rotY, alpha)
          );
        } else {
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          if (Math.hypot(dx, dz) > 0.01) {
            object.rotation.y = Math.atan2(dx, dz);
          }
        }
      } else if (
        element.kind === 'planet' &&
        element.planetSpec &&
        element.planetSpec.bodyRole !== 'star' &&
        element.planetSpec.orbitRadiusX > 0
      ) {
        const ps = element.planetSpec;
        const angle =
          ps.orbitStartAngle + localTimeSec * element.motion.speed * 0.7;
        const rx = ps.orbitRadiusX * 48;
        const rz = ps.orbitRadiusY * 48;
        object.position.set(
          Math.cos(angle) * rx,
          basePos.y,
          Math.sin(angle) * rz
        );
      } else if (
        element.motion.type === 'move-horizontal' ||
        element.motion.type === 'chase'
      ) {
        isMoving = Math.abs(element.motion.speed) > 0.02;
        const delta = localTimeSec * element.motion.speed * 3.2 * element.motion.direction;
        object.position.set(basePos.x + delta, basePos.y, basePos.z);
        if (Math.abs(delta) > 0.01 && baseRot.y === 0) {
          object.rotation.y = element.motion.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      } else if (element.motion.type === 'bob') {
        object.position.set(
          basePos.x,
          basePos.y + Math.sin(localTimeSec * 2.2 * element.motion.speed) * 0.8,
          basePos.z
        );
      } else if (element.motion.type === 'orbit') {
        isMoving = true;
        const radius = Math.max(4, element.motion.amplitude * 40);
        const ang = localTimeSec * element.motion.speed * 0.9;
        const nx = basePos.x + Math.cos(ang) * radius;
        const nz = basePos.z + Math.sin(ang) * radius;
        object.position.set(nx, basePos.y + Math.sin(ang * 2) * 1.2, nz);
        // Face tangent direction along orbit
        const tx = -Math.sin(ang);
        const tz = Math.cos(ang);
        object.rotation.y = Math.atan2(tx, tz);
      } else {
        object.position.copy(basePos);
        object.rotation.copy(baseRot);
        object.scale.copy(baseScale);
      }

      // Animate internal composite rigs
      const rig = object.userData.rig as
        | CharacterJointRig
        | VehicleRigData
        | DroneRigData
        | PlanetRigData
        | ProductRigData
        | ExternalAssetRigData
        | { type: 'custom' }
        | undefined;
      if (rig?.type === 'character') {
        animateCharacterRig(
          rig,
          tSec,
          isMoving,
          Math.max(0.75, Math.abs(element.motion.speed))
        );
      } else if (rig?.type === 'vehicle') {
        for (const w of rig.wheels) {
          w.rotation.x = tSec * 14 * Math.max(0.6, Math.abs(element.motion.speed));
        }
        const flicker = 0.85 + Math.sin(tSec * 38) * 0.18;
        for (const flame of rig.thrusters) {
          flame.scale.set(1, flicker, 1);
        }
      } else if (rig?.type === 'drone') {
        for (const r of rig.rotors) {
          r.rotation.y = tSec * 28;
        }
      } else if (rig?.type === 'planet') {
        rig.bodyMesh.rotation.y = tSec * 0.25;
      } else if (rig?.type === 'product') {
        if (rig.turntableSpin) {
          rig.productGroup.rotation.y = tSec * 0.65;
        }
        if (rig.secondHand) {
          rig.secondHand.rotation.z = -tSec * ((Math.PI * 2) / 60) * 6;
        }
      } else if (rig?.type === 'external-asset' && rig.mixer) {
        rig.mixer.setTime(localTimeSec);
      } else if (element.kind === 'custom' || rig?.type === 'custom') {
        animateCustomModel(object, localTimeSec);
      }
    }

    // Update animated custom GLSL shader time uniforms deterministically
    updateShaderUniformsInObject(this.sceneContentGroup, tSec);

    // Update weather particles deterministically at tSec
    if (this.weatherSystem) {
      const { points, velocities, basePositions, spreadX, spreadY, spreadZ } =
        this.weatherSystem;
      const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < posAttr.count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];
        const vx = velocities[i * 3];
        const vy = velocities[i * 3 + 1];
        const vz = velocities[i * 3 + 2];

        const wrap = (val: number, span: number, min: number) =>
          ((((val - min) % span) + span) % span) + min;

        arr[i * 3] = wrap(bx + vx * tSec, spreadX, -spreadX / 2);
        arr[i * 3 + 1] = wrap(by + vy * tSec, spreadY, 0);
        arr[i * 3 + 2] = wrap(bz + vz * tSec, spreadZ, -spreadZ / 2);
      }
      posAttr.needsUpdate = true;
    }

    // Update volumetric light shafts deterministically as a pure function of localTimeSec
    for (let i = 0; i < this.lightShafts.length; i++) {
      const s = this.lightShafts[i];
      s.mesh.rotation.z = s.baseRotZ + Math.sin(localTimeSec * s.speed + s.phase) * 0.09;
      s.mesh.rotation.x = s.baseRotX + Math.cos(localTimeSec * s.speed * 0.75 + s.phase) * 0.05;
      s.material.opacity =
        s.baseOpacity * (0.78 + 0.22 * Math.sin(localTimeSec * s.speed * 1.65 + s.phase));
    }

    // Update subtle moving caustic lights deterministically as a pure function of localTimeSec
    for (let i = 0; i < this.causticLights.length; i++) {
      const c = this.causticLights[i];
      c.light.position.set(
        c.basePos.x + Math.sin(localTimeSec * c.speedX + c.phase) * c.driftRadius,
        c.basePos.y + Math.sin(localTimeSec * 0.55 + c.phase) * 0.35,
        c.basePos.z + Math.cos(localTimeSec * c.speedZ + c.phase) * c.driftRadius
      );
      c.light.intensity =
        c.baseIntensity * (0.76 + 0.24 * Math.sin(localTimeSec * c.pulseSpeed + c.phase));
    }

    // Evaluate Camera Rig unless user actively took over manual OrbitControls
    const effectiveCamCfg = this.activeCamera3d ?? segment.scene3d?.camera3d;
    const effectiveDampDt = wrappedLoop ? undefined : smoothDampDeltaSec;

    if (!this.interactiveOrbit && this.activeCustomDolly) {
      // Custom-subject dolly helper owns the camera; AI camera keyframes never override it
      const dolly = this.activeCustomDolly;
      const span = Math.max(0.01, dolly.dollyEndFraction - dolly.dollyStartFraction);
      const rawU = Math.max(0, Math.min(1, (normT - dolly.dollyStartFraction) / span));
      const eased =
        rawU < 0.5
          ? 2 * rawU * rawU
          : 1 - Math.pow(-2 * rawU + 2, 2) / 2;

      this.scene.updateMatrixWorld(true);
      _vecA.subVectors(dolly.subjectObject.position, dolly.subjectBasePos);

      _focusBox.setFromObject(dolly.focusPartObject);
      if (!_focusBox.isEmpty()) {
        _focusBox.getCenter(_focusCenter);
        _vecB.subVectors(_focusCenter, dolly.initialFocusCenter);
      } else {
        _vecB.copy(_vecA);
      }

      _vecC.copy(dolly.startPosition).add(_vecA);
      _vecD.copy(dolly.endPosition).add(_vecB);
      _desiredCamPos.lerpVectors(_vecC, _vecD, eased);

      _vecC.copy(dolly.startTarget).add(_vecA);
      _vecD.copy(dolly.endTarget).add(_vecB);
      _desiredCamTarget.lerpVectors(_vecC, _vecD, eased);

      if (effectiveDampDt && effectiveDampDt > 0) {
        const lambda = 9;
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _desiredCamPos.x, lambda, effectiveDampDt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _desiredCamPos.y, lambda, effectiveDampDt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _desiredCamPos.z, lambda, effectiveDampDt);
        this.currentTarget.x = THREE.MathUtils.damp(this.currentTarget.x, _desiredCamTarget.x, lambda, effectiveDampDt);
        this.currentTarget.y = THREE.MathUtils.damp(this.currentTarget.y, _desiredCamTarget.y, lambda, effectiveDampDt);
        this.currentTarget.z = THREE.MathUtils.damp(this.currentTarget.z, _desiredCamTarget.z, lambda, effectiveDampDt);
      } else {
        this.camera.position.copy(_desiredCamPos);
        this.currentTarget.copy(_desiredCamTarget);
      }

      if ((this.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const pCam = this.camera as THREE.PerspectiveCamera;
        if (Math.abs(pCam.fov - dolly.fov) > 0.05) {
          pCam.fov = dolly.fov;
          pCam.updateProjectionMatrix();
        }
      }

      this.camera.lookAt(this.currentTarget);
      this.camera.updateMatrixWorld(true);

      if (isDevLoggingEnabled() && !dolly.loggedFramePath) {
        dolly.loggedFramePath = true;
        console.log('[VYROXX CameraDiag:seekTime]', {
          segmentId: dolly.segmentId,
          codePath: 'custom-subject-dolly',
          tSec: Number(tSec.toFixed(2)),
          dollyProgress: Number(rawU.toFixed(3)),
          cameraPosition: fmtVec(this.camera.position),
          cameraTarget: fmtVec(this.currentTarget),
          distanceToTarget: Number(this.camera.position.distanceTo(this.currentTarget).toFixed(3)),
        });
      }
    } else if (!this.interactiveOrbit && effectiveCamCfg) {
      let followObj: THREE.Object3D | undefined;
      if (effectiveCamCfg.followElementId) {
        followObj = this.trackedElements.find(
          (t) => t.element.id === effectiveCamCfg.followElementId
        )?.object;
      }
      if (
        !followObj &&
        (effectiveCamCfg.motion === 'follow-subject' ||
          effectiveCamCfg.motion === 'tracking' ||
          effectiveCamCfg.motion === 'orbit')
      ) {
        followObj = this.trackedElements.find((t) =>
          ['product', 'character', 'vehicle', 'planet', 'drone', 'custom'].includes(
            t.element.kind
          )
        )?.object;
      }

      evaluateCameraRig(this.camera, this.currentTarget, {
        camera3d: effectiveCamCfg,
        localTimeSec,
        segmentDurationSec: segDur,
        followObject: followObj,
        smoothDampDeltaSec: effectiveDampDt,
      });

      if (isDevLoggingEnabled() && !this.loggedNonCustomCameraPath) {
        this.loggedNonCustomCameraPath = true;
        console.log('[VYROXX CameraDiag:seekTime]', {
          segmentId: segment.id,
          codePath: 'standard-camera-rig',
          tSec: Number(tSec.toFixed(2)),
          cameraPosition: fmtVec(this.camera.position),
          cameraTarget: fmtVec(this.currentTarget),
          distanceToTarget: Number(this.camera.position.distanceTo(this.currentTarget).toFixed(3)),
        });
      }
    } else if (this.controls && this.interactiveOrbit) {
      this.controls.update();
      if (isDevLoggingEnabled() && !this.loggedNonCustomCameraPath) {
        this.loggedNonCustomCameraPath = true;
        console.log('[VYROXX CameraDiag:seekTime]', {
          segmentId: segment.id,
          codePath: 'interactive-orbit',
          tSec: Number(tSec.toFixed(2)),
        });
      }
    }

    this.scene.updateMatrixWorld(true);
  }

  public renderFrame(): void {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  public inspectSceneAtTime(tSec: number): InspectedSceneSnapshot {
    this.seekTime(tSec);
    const { segment } = this.resolveSegmentAtTime(tSec);

    let lightCount = 0;
    let shadowCastingLightCount = 0;
    this.scene.traverse((obj) => {
      if ((obj as THREE.Light).isLight) {
        lightCount++;
        if ((obj as THREE.Light).castShadow) shadowCastingLightCount++;
      }
    });

    const elements: InspectedElementSnapshot[] = this.trackedElements.map((item) => {
      _box.setFromObject(item.object);
      let meshCount = 0;
      let instancedTotalCount = 0;
      let outlineMeshCount = 0;
      let hasFlatShading = false;
      let hasShaderMaterial = false;
      let shaderTimeUniform: number | null = null;
      const matTypes = new Set<string>();

      item.object.traverse((child) => {
        const asMesh = child as THREE.Mesh;
        if (child.userData.isOutline) {
          outlineMeshCount++;
        }
        if ((child as THREE.InstancedMesh).isInstancedMesh) {
          instancedTotalCount += (child as THREE.InstancedMesh).count;
          meshCount++;
        } else if (asMesh.isMesh) {
          meshCount++;
        }
        if (asMesh.isMesh && asMesh.material) {
          const mats = Array.isArray(asMesh.material) ? asMesh.material : [asMesh.material];
          for (const m of mats) {
            matTypes.add(m.type);
            if ('flatShading' in m && (m as THREE.MeshStandardMaterial).flatShading) {
              hasFlatShading = true;
            }
            if (m instanceof THREE.ShaderMaterial) {
              hasShaderMaterial = true;
              if (typeof m.uniforms?.uTime?.value === 'number') {
                shaderTimeUniform = Number(m.uniforms.uTime.value.toFixed(4));
              }
            }
          }
        }
      });

      item.object.getWorldPosition(_vecA);
      // Project bounding-box center so tall objects project cleanly
      _box.getCenter(_vecB);
      const projected = projectWorldPoint(
        _vecB,
        this.camera,
        this.width,
        this.height
      );

      const rig = item.object.userData.rig as CharacterJointRig | undefined;
      const jointSample =
        rig?.type === 'character'
          ? {
              leftHipX: rig.leftHip.rotation.x,
              rightHipX: rig.rightHip.rotation.x,
              leftKneeX: rig.leftKnee.rotation.x,
              leftShoulderX: rig.leftShoulder.rotation.x,
              pelvisY: rig.pelvis.position.y,
            }
          : undefined;

      const dInfo = item.object.userData.doorwayInfo as
        | BuildingDoorwayInfo
        | undefined;
      const doorwayInfo = dInfo
        ? {
            hasDoorway: dInfo.hasDoorway,
            doorwayWidth: dInfo.doorwayWidth,
            doorwayHeight: dInfo.doorwayHeight,
            doorwaySide: dInfo.doorwaySide,
            width: dInfo.width,
            height: dInfo.height,
            depth: dInfo.depth,
          }
        : undefined;

      return {
        id: item.element.id,
        kind: item.element.kind,
        label: item.element.label,
        worldPosition: {
          x: Number(_vecA.x.toFixed(3)),
          y: Number(_vecA.y.toFixed(3)),
          z: Number(_vecA.z.toFixed(3)),
        },
        rotationYDeg: Number(
          THREE.MathUtils.radToDeg(item.object.rotation.y).toFixed(2)
        ),
        boundingBoxMin: {
          x: Number(_box.min.x.toFixed(3)),
          y: Number(_box.min.y.toFixed(3)),
          z: Number(_box.min.z.toFixed(3)),
        },
        boundingBoxMax: {
          x: Number(_box.max.x.toFixed(3)),
          y: Number(_box.max.y.toFixed(3)),
          z: Number(_box.max.z.toFixed(3)),
        },
        meshCount,
        instancedTotalCount,
        outlineMeshCount,
        materialTypes: Array.from(matTypes),
        hasFlatShading,
        hasShaderMaterial,
        shaderTimeUniform,
        projected,
        ...(jointSample ? { jointSample } : {}),
        ...(doorwayInfo ? { doorwayInfo } : {}),
      };
    });

    const isPersp = (this.camera as THREE.PerspectiveCamera).isPerspectiveCamera;
    return {
      timeSec: tSec,
      sceneId: segment.id,
      visualStyle: resolveSceneVisualStyle(this.plan, segment),
      environment: segment.scene3d?.environment || 'unknown',
      cameraType: isPersp ? 'perspective' : 'orthographic',
      cameraPosition: {
        x: Number(this.camera.position.x.toFixed(3)),
        y: Number(this.camera.position.y.toFixed(3)),
        z: Number(this.camera.position.z.toFixed(3)),
      },
      cameraTarget: {
        x: Number(this.currentTarget.x.toFixed(3)),
        y: Number(this.currentTarget.y.toFixed(3)),
        z: Number(this.currentTarget.z.toFixed(3)),
      },
      cameraFov: isPersp ? (this.camera as THREE.PerspectiveCamera).fov : 0,
      hasFog: Boolean(this.scene.fog),
      fogDensity:
        this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.density : 0,
      hasEnvMap: Boolean(this.scene.environment),
      lightCount,
      shadowCastingLightCount,
      elements,
    };
  }

  public dispose(): void {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    for (const child of this.sceneContentGroup.children) {
      if (child instanceof THREE.Group && child.userData?.rig?.type === 'custom') {
        disposeCustomModel(child);
      }
    }
    disposeObject3D(this.scene);
    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }
    if (this.envPmrem) {
      this.envPmrem.dispose();
      this.envPmrem = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
