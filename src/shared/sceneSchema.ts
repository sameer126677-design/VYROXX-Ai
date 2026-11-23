import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
export const HexColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, 'Must be a 6-digit hex color like #38bdf8');

export const MotionCommandSchema = z.object({
  type: z.enum([
    'static',
    'move-horizontal',
    'move-vertical',
    'bob',
    'orbit',
    'chase',
    'pulse',
    'pan-parallax',
  ]),
  speed: z.number().min(-4).max(4),
  amplitude: z.number().min(0).max(0.5),
  direction: z.union([z.literal(1), z.literal(-1)]),
});

export const ChartPointSchema = z.object({
  label: z.string().min(1).max(24),
  value: z.number().min(-1_000_000_000).max(1_000_000_000),
});

export const ChartSpecSchema = z.object({
  chartType: z.enum(['line', 'area', 'bar']),
  title: z.string().min(1).max(100),
  xAxisLabel: z.string().max(40),
  yAxisLabel: z.string().max(40),
  valuePrefix: z.string().max(8),
  valueSuffix: z.string().max(16),
  smoothCurve: z.boolean(),
  easing: z.enum(['linear', 'accelerate', 'ease-out']),
  showGrid: z.boolean(),
  showAreaFill: z.boolean(),
  showMovingMarker: z.boolean(),
  highlightFinalBadge: z.string().max(48),
  points: z.array(ChartPointSchema).min(2).max(16),
});

export const CharacterSpecSchema = z.object({
  archetype: z.enum([
    'ranger',
    'survivor',
    'soldier',
    'cyberpunk',
    'citizen',
    'astronaut',
    'wizard',
    'robot',
    'zombie',
    'beast',
  ]),
  pose: z.enum([
    'running',
    'sprinting',
    'walking',
    'idle',
    'aiming',
    'combat',
    'floating',
    'chasing',
    'kneeling',
  ]),
  expression: z.enum(['determined', 'alert', 'calm', 'fierce', 'hollow']),
  armorStyle: z.enum([
    'none',
    'tactical',
    'heavy-plate',
    'cyber-suit',
    'trench-coat',
    'hoodie',
    'spacesuit',
  ]),
  armorColor: HexColorSchema,
  secondaryGearColor: HexColorSchema,
  headgear: z.enum([
    'none',
    'helmet',
    'visor-helmet',
    'hood',
    'cap',
    'cyber-optics',
    'crown',
  ]),
  visorColor: HexColorSchema,
  cloakOrCoat: z.boolean(),
  cloakColor: HexColorSchema,
  weaponOrGear: z.enum([
    'none',
    'rifle',
    'blade',
    'scanner',
    'backpack',
    'briefcase',
    'umbrella',
    'shield',
  ]),
  hairColor: HexColorSchema,
  detailLevel: z.enum(['standard', 'high', 'hero']),
});

export const VehicleSpecSchema = z.object({
  subKind: z.enum([
    'racing-car',
    'sports-car',
    'cyber-car',
    'truck',
    'hover-bike',
    'spaceship',
    'helicopter',
    'ufo',
  ]),
  speedLines: z.boolean(),
  headlights: z.boolean(),
  exhaustFlame: z.boolean(),
  wheelSpin: z.boolean(),
  numberTag: z.string().max(10),
});

export const DroneSpecSchema = z.object({
  rotorCount: z.number().int().min(2).max(6),
  hasSearchlight: z.boolean(),
  searchlightColor: HexColorSchema,
  searchlightAngleDeg: z.number().min(-85).max(85),
  statusLedColor: HexColorSchema,
});

export const PlanetSpecSchema = z.object({
  bodyRole: z.enum(['star', 'planet', 'moon', 'dwarf']),
  radiusScale: z.number().min(0.15).max(3.5),
  hasRings: z.boolean(),
  ringColor: HexColorSchema,
  orbitCenterX: z.number().min(-0.2).max(1.2),
  orbitCenterY: z.number().min(-0.2).max(1.2),
  orbitRadiusX: z.number().min(0).max(0.75),
  orbitRadiusY: z.number().min(0).max(0.6),
  orbitStartAngle: z.number().min(-6.3).max(6.3),
  showOrbitPath: z.boolean(),
  showLabel: z.boolean(),
  surfaceStyle: z.enum([
    'rocky',
    'gas-bands',
    'earth-like',
    'molten',
    'icy',
    'sun-corona',
  ]),
});

export const TextSpecSchema = z.object({
  text: z.string().min(1).max(160),
  subtext: z.string().max(160),
  fontSize: z.enum(['sm', 'md', 'lg', 'xl', 'hero']),
  align: z.enum(['left', 'center', 'right']),
  revealEffect: z.enum([
    'none',
    'fade-in',
    'slide-up',
    'typewriter',
    'scale-pop',
    'glow-pulse',
  ]),
  showBackdrop: z.boolean(),
});

export const LogoSpecSchema = z.object({
  brandText: z.string().min(1).max(60),
  tagline: z.string().max(100),
  emblemShape: z.enum([
    'shield',
    'hexagon',
    'diamond',
    'wing-v',
    'orbit',
    'circuit',
    'prism',
    'crown',
  ]),
  revealStyle: z.enum(['wipe', 'assemble', 'burst', 'pulse-draw']),
});

export const RoadSpecSchema = z.object({
  perspective: z.enum(['flat', 'perspective', 'wet-neon']),
  lanes: z.number().int().min(1).max(6),
  scrollSpeed: z.number().min(-5).max(5),
  wetReflections: z.boolean(),
});

export const Vector3Schema = z.object({
  x: z.number().min(-500).max(500),
  y: z.number().min(-500).max(500),
  z: z.number().min(-500).max(500),
});

export const Size3DSchema = z.object({
  w: z.number().min(0.1).max(200),
  h: z.number().min(0.1).max(250),
  d: z.number().min(0.1).max(200),
});

export const Keyframe3DSchema = z.object({
  t: z.number().min(0).max(1),
  x: z.number().min(-500).max(500),
  y: z.number().min(-500).max(500),
  z: z.number().min(-500).max(500),
  rotY: z.number().min(-720).max(720).optional(),
});

export const BuildingSpec3DSchema = z.object({
  floors: z.number().int().min(1).max(40),
  style: z.enum([
    'modern-glass',
    'concrete',
    'ruined',
    'neon-tower',
    'cottage',
    'warehouse',
  ]),
  hasDoorway: z.boolean(),
  doorwaySide: z.enum(['front', 'back', 'left', 'right']),
  doorwayWidth: z.number().min(1).max(8),
  doorwayHeight: z.number().min(2).max(8),
  doorwayOpen: z.boolean(),
  interiorLit: z.boolean(),
  interiorColor: HexColorSchema,
});

export const VISUAL_STYLES = [
  'realistic-pbr',
  'anime-cel',
  'low-poly',
  'stylized-3d',
  'cartoon-2d',
  'vector-motion',
  'pixel-retro',
  'hologram-shader',
  'abstract-generative',
] as const;

export const VisualStyleSchema = z.enum(VISUAL_STYLES);

export const PHYSICS_MODES = [
  'none',
  'projectile',
  'bounce',
  'spring',
  'pendulum',
  'orbit-gravity',
  'buoyancy',
] as const;

export const PhysicsSpecSchema = z.object({
  mode: z.enum(PHYSICS_MODES),
  gravity: z.number().min(-50).max(50).optional(),
  initialVelocity: Vector3Schema.optional(),
  restitution: z.number().min(0).max(0.98).optional(),
  damping: z.number().min(0).max(5).optional(),
  springK: z.number().min(0.5).max(80).optional(),
  amplitude: z.number().min(0).max(30).optional(),
  groundY: z.number().min(-20).max(20).optional(),
  squashStretch: z.boolean().optional(),
});

export const SHADER_PRESETS = [
  'none',
  'toon-outline',
  'fresnel-hologram',
  'energy-plasma',
  'water-waves',
  'neon-grid',
] as const;

export const ShaderSpecSchema = z.object({
  preset: z.enum(SHADER_PRESETS),
  primaryColor: HexColorSchema.optional(),
  secondaryColor: HexColorSchema.optional(),
  speed: z.number().min(-5).max(5).optional(),
  intensity: z.number().min(0.1).max(5).optional(),
});

export const PROCEDURAL_GEOMETRIES = [
  'sphere',
  'box',
  'torus',
  'cone',
  'cylinder',
  'icosahedron',
  'torus-knot',
  'wave-plane',
] as const;

export const ProceduralGeometrySchema = z.enum(PROCEDURAL_GEOMETRIES);

export const AssetRefSchema = z.object({
  format: z.enum(['glb', 'gltf', 'svg', 'image']),
  storagePath: z.string().max(300).optional(),
  inlineDataUri: z.string().max(2_000_000).optional(),
  normalizeHeight: z.number().min(0.2).max(100).optional(),
});

export const ProductSpec3DSchema = z.object({
  productType: z.enum([
    'watch',
    'headphones',
    'bottle',
    'sneaker',
    'phone',
    'orb-sculpture',
    'car-model',
  ]),
  materialFinish: z.enum([
    'brushed-metal',
    'chrome',
    'glass',
    'carbon',
    'gold',
    'matte-ceramic',
  ]),
  hasPedestal: z.boolean(),
  turntableSpin: z.boolean(),
});

export const CUSTOM_MODEL_SHAPES = [
  'box',
  'sphere',
  'cylinder',
  'cone',
  'capsule',
  'torus',
  'plane',
] as const;

export const CustomModelShapeSchema = z.enum(CUSTOM_MODEL_SHAPES);

export const CUSTOM_PART_MOTION_TYPES = [
  'none',
  'sway',
  'rotate',
  'bob',
  'pulse',
] as const;

export const CUSTOM_MOTION_AXES = ['x', 'y', 'z'] as const;

export const CustomModelPartSchema = z.object({
  id: z.string().min(1).max(64),
  shape: CustomModelShapeSchema,
  px: z.number().min(-50).max(50),
  py: z.number().min(-50).max(50),
  pz: z.number().min(-50).max(50),
  rxDeg: z.number().min(-360).max(360),
  ryDeg: z.number().min(-360).max(360),
  rzDeg: z.number().min(-360).max(360),
  sx: z.number().min(0.01).max(50),
  sy: z.number().min(0.01).max(50),
  sz: z.number().min(0.01).max(50),
  color: HexColorSchema,
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
  emissive: HexColorSchema.optional(),
  emissiveIntensity: z.number().min(0).max(5),
  opacity: z.number().min(0).max(1),
  motionType: z.enum(CUSTOM_PART_MOTION_TYPES),
  motionAxis: z.enum(CUSTOM_MOTION_AXES),
  motionSpeed: z.number().min(-20).max(20),
  motionAmplitude: z.number().min(0).max(20),
});

export const CustomModelSpecSchema = z.object({
  description: z.string().max(200),
  focusPartId: z.string().min(1).max(64).optional(),
  parts: z.array(CustomModelPartSchema).min(1).max(40),
});

export const Camera3DSchema = z.object({
  projection: z.enum(['perspective', 'orthographic']),
  shotType: z.enum([
    'wide',
    'close-up',
    'extreme-close-up',
    'low-angle',
    'high-angle',
    'birds-eye',
    'over-the-shoulder',
    'tracking',
    'orbit',
    'custom',
  ]),
  fov: z.number().min(18).max(110),
  position: Vector3Schema,
  target: Vector3Schema,
  endPosition: Vector3Schema.optional(),
  endTarget: Vector3Schema.optional(),
  motion: z.enum([
    'static',
    'dolly-in',
    'dolly-out',
    'orbit',
    'pan',
    'tilt',
    'follow-subject',
    'tracking',
    'flythrough',
  ]),
  orbitRadius: z.number().min(1).max(160),
  orbitSpeed: z.number().min(-4).max(4),
  followElementId: z.string().max(64).optional(),
  followOffset: Vector3Schema.optional(),
});

export const Scene3DConfigSchema = z.object({
  environment: z.enum([
    'city',
    'street',
    'forest',
    'space',
    'racetrack',
    'studio',
    'interior',
    'wasteland',
  ]),
  groundType: z.enum([
    'asphalt',
    'grass',
    'dirt',
    'studio-floor',
    'grid',
    'track',
    'none',
  ]),
  groundSize: z.number().min(20).max(600),
  fogColor: HexColorSchema,
  fogDensity: z.number().min(0).max(0.08),
  sunElevationDeg: z.number().min(2).max(90),
  sunAzimuthDeg: z.number().min(-180).max(180),
  sunIntensity: z.number().min(0).max(5),
  ambientIntensity: z.number().min(0).max(2.5),
  camera3d: Camera3DSchema,
});

export const SceneElementSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum([
    'skyline',
    'mountains',
    'trees',
    'clouds',
    'sun-moon',
    'grid-floor',
    'character',
    'creature',
    'vehicle',
    'drone',
    'planet',
    'chart',
    'text',
    'logo',
    'road',
    'particle-burst',
    'prop',
    'energy-ring',
    'light-beam',
    'building',
    'product',
    'procedural-mesh',
    'shader-fx',
    'external-asset',
    'custom',
  ]),
  label: z.string().min(1).max(80),
  x: z.number().min(-0.3).max(1.3),
  y: z.number().min(-0.3).max(1.3),
  scale: z.number().min(0.15).max(3.5),
  colorPrimary: HexColorSchema,
  colorSecondary: HexColorSchema,
  accentColor: HexColorSchema,
  variant: z.enum([
    'running',
    'walking',
    'idle',
    'chasing',
    'hovering',
    'flying',
    'ruined',
    'glowing',
    'medieval',
    'futuristic',
    'organic',
    'cyberpunk',
    'tactical',
    'cinematic',
    'neon',
    'minimal',
    'armored',
  ]),
  count: z.number().int().min(1).max(16),
  depth: z.number().min(0).max(1),
  opacity: z.number().min(0.05).max(1).optional(),
  rotationDeg: z.number().min(-360).max(360).optional(),
  motion: MotionCommandSchema,
  chartSpec: ChartSpecSchema.optional(),
  characterSpec: CharacterSpecSchema.optional(),
  vehicleSpec: VehicleSpecSchema.optional(),
  droneSpec: DroneSpecSchema.optional(),
  planetSpec: PlanetSpecSchema.optional(),
  textSpec: TextSpecSchema.optional(),
  logoSpec: LogoSpecSchema.optional(),
  roadSpec: RoadSpecSchema.optional(),
  pos3d: Vector3Schema.optional(),
  rot3d: Vector3Schema.optional(),
  size3d: Size3DSchema.optional(),
  path3d: z.array(Keyframe3DSchema).max(16).optional(),
  buildingSpec3d: BuildingSpec3DSchema.optional(),
  productSpec3d: ProductSpec3DSchema.optional(),
  physicsSpec: PhysicsSpecSchema.optional(),
  shaderSpec: ShaderSpecSchema.optional(),
  proceduralGeometry: ProceduralGeometrySchema.optional(),
  assetRef: AssetRefSchema.optional(),
  customModelSpec: CustomModelSpecSchema.optional(),
});

export const SceneSegmentSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(100),
  durationSec: z.number().min(2).max(20),
  transition: z.enum(['cut', 'fade', 'pan-wipe']),
  visualStyle: VisualStyleSchema.optional(),
  background: z.object({
    mode: z.enum(['scene', 'solid', 'transparent']),
    solidColor: HexColorSchema,
    skyTop: HexColorSchema,
    skyBottom: HexColorSchema,
    horizonColor: HexColorSchema,
    groundColor: HexColorSchema,
    groundElevation: z.number().min(0.4).max(0.98),
  }),
  camera: z.object({
    motion: z.enum([
      'static',
      'pan-left',
      'pan-right',
      'zoom-in',
      'zoom-out',
      'follow-subject',
      'handheld-shake',
    ]),
    intensity: z.number().min(0).max(1),
  }),
  lighting: z.object({
    mood: z.enum([
      'daylight',
      'cinematic',
      'neon',
      'noir',
      'golden-hour',
      'eerie-ash',
    ]),
    ambientAlpha: z.number().min(0).max(0.75),
    bloomColor: HexColorSchema,
    volumetricRays: z.union([z.boolean(), z.number().min(0).max(1)]),
    vignette: z.number().min(0).max(1),
  }),
  weather: z.object({
    type: z.enum(['none', 'rain', 'snow', 'ash', 'fog', 'stars', 'sparks']),
    density: z.number().min(0).max(1),
    windX: z.number().min(-1).max(1),
  }),
  elements: z.array(SceneElementSchema).min(1).max(28),
  scene3d: Scene3DConfigSchema.optional(),
});

export const CharacterBibleEntrySchema = z.object({
  name: z.string().min(1).max(60),
  role: z.string().min(1).max(80),
  appearance: z.string().min(1).max(240),
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
});

export const VisualContinuityBibleSchema = z.object({
  artStyle: z.string().min(1).max(160),
  colorPalette: z.array(HexColorSchema).min(2).max(8),
  environmentRules: z.string().min(1).max(280),
  lightingStyle: z.string().min(1).max(160),
  characterBible: z.array(CharacterBibleEntrySchema).max(8),
  propReferences: z.array(z.string().min(1).max(80)).max(12),
});

export const AnimationScenePlanSchema = z.object({
  planVersion: z.literal(1),
  renderMode: z.enum(['2d', '3d']).optional(),
  visualStyle: VisualStyleSchema.optional(),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  width: z.number().int().min(128).max(4096),
  height: z.number().int().min(128).max(4096),
  fps: z.number().int().min(12).max(120),
  totalDurationSec: z.number().min(2).max(60),
  scenes: z.array(SceneSegmentSchema).min(1).max(6),
  visualContinuity: VisualContinuityBibleSchema,
});

export type VisualStyle = z.infer<typeof VisualStyleSchema>;
export type PhysicsSpec = z.infer<typeof PhysicsSpecSchema>;
export type ShaderSpec = z.infer<typeof ShaderSpecSchema>;
export type ProceduralGeometryType = z.infer<typeof ProceduralGeometrySchema>;

export function resolveVolumetricRaysIntensity(
  val: boolean | number | undefined
): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.max(0, Math.min(1, val));
  }
  return val ? 0.65 : 0;
}
export type AssetRefSpec = z.infer<typeof AssetRefSchema>;
export type Vector3Spec = z.infer<typeof Vector3Schema>;
export type Size3DSpec = z.infer<typeof Size3DSchema>;
export type Keyframe3DSpec = z.infer<typeof Keyframe3DSchema>;
export type BuildingSpec3D = z.infer<typeof BuildingSpec3DSchema>;
export type ProductSpec3D = z.infer<typeof ProductSpec3DSchema>;
export type CustomModelShape = z.infer<typeof CustomModelShapeSchema>;
export type CustomPartMotionType = (typeof CUSTOM_PART_MOTION_TYPES)[number];
export type CustomMotionAxis = (typeof CUSTOM_MOTION_AXES)[number];
export type CustomModelPart = z.infer<typeof CustomModelPartSchema>;
export type CustomModelSpec = z.infer<typeof CustomModelSpecSchema>;
export type Camera3DSpec = z.infer<typeof Camera3DSchema>;
export type Scene3DConfig = z.infer<typeof Scene3DConfigSchema>;
export type MotionCommand = z.infer<typeof MotionCommandSchema>;
export type ChartPoint = z.infer<typeof ChartPointSchema>;
export type ChartSpec = z.infer<typeof ChartSpecSchema>;
export type CharacterSpec = z.infer<typeof CharacterSpecSchema>;
export type VehicleSpec = z.infer<typeof VehicleSpecSchema>;
export type DroneSpec = z.infer<typeof DroneSpecSchema>;
export type PlanetSpec = z.infer<typeof PlanetSpecSchema>;
export type TextSpec = z.infer<typeof TextSpecSchema>;
export type LogoSpec = z.infer<typeof LogoSpecSchema>;
export type RoadSpec = z.infer<typeof RoadSpecSchema>;
export type SceneElement = z.infer<typeof SceneElementSchema>;
export type SceneSegment = z.infer<typeof SceneSegmentSchema>;
export type CharacterBibleEntry = z.infer<typeof CharacterBibleEntrySchema>;
export type VisualContinuityBible = z.infer<typeof VisualContinuityBibleSchema>;
export type AnimationScenePlan = z.infer<typeof AnimationScenePlanSchema>;

const STYLES_2D_PREFERRED = new Set<VisualStyle>([
  'cartoon-2d',
  'vector-motion',
  'pixel-retro',
  'abstract-generative',
]);

const STYLES_3D_PREFERRED = new Set<VisualStyle>([
  'realistic-pbr',
  'anime-cel',
  'low-poly',
  'stylized-3d',
  'hologram-shader',
]);

export function resolveSceneVisualStyle(
  plan: AnimationScenePlan | null | undefined,
  segment?: SceneSegment | null
): VisualStyle {
  if (segment?.visualStyle) return segment.visualStyle;
  if (plan?.visualStyle) return plan.visualStyle;
  if (plan?.renderMode === '3d') return 'realistic-pbr';
  if (plan?.renderMode === '2d') return 'vector-motion';
  return is3DScenePlan(plan) ? 'realistic-pbr' : 'vector-motion';
}

export function is3DScenePlan(plan: AnimationScenePlan | null | undefined): boolean {
  if (!plan || !Array.isArray(plan.scenes)) return false;
  if (plan.renderMode === '3d') return true;
  if (plan.renderMode === '2d') return false;
  if (plan.visualStyle && STYLES_3D_PREFERRED.has(plan.visualStyle)) return true;

  const hasAny3DFields = plan.scenes.some(
    (s) =>
      Boolean(s?.scene3d) ||
      Boolean(s?.visualStyle && STYLES_3D_PREFERRED.has(s.visualStyle)) ||
      (Array.isArray(s?.elements) &&
        s.elements.some((el) =>
          Boolean(
            el?.pos3d ||
              el?.rot3d ||
              el?.size3d ||
              el?.path3d ||
              el?.buildingSpec3d ||
              el?.productSpec3d ||
              el?.customModelSpec ||
              el?.shaderSpec ||
              el?.assetRef ||
              el?.kind === 'building' ||
              el?.kind === 'product' ||
              el?.kind === 'custom' ||
              el?.kind === 'shader-fx' ||
              el?.kind === 'external-asset' ||
              el?.kind === 'procedural-mesh'
          )
        ))
  );
  if (hasAny3DFields) return true;
  if (plan.visualStyle && STYLES_2D_PREFERRED.has(plan.visualStyle)) return false;
  return false;
}

export const EMPTY_VISUAL_CONTINUITY: VisualContinuityBible = {
  artStyle: 'Atmospheric 2D Vector Cinematic',
  colorPalette: ['#071124', '#38bdf8', '#e2e8f0', '#0f172a'],
  environmentRules: 'Maintained automatically from your first approved scene.',
  lightingStyle: 'Balanced cinematic rim lighting',
  characterBible: [],
  propReferences: [],
};

export function createDefaultVisualContinuity(): VisualContinuityBible {
  return {
    artStyle: EMPTY_VISUAL_CONTINUITY.artStyle,
    colorPalette: [...EMPTY_VISUAL_CONTINUITY.colorPalette],
    environmentRules: EMPTY_VISUAL_CONTINUITY.environmentRules,
    lightingStyle: EMPTY_VISUAL_CONTINUITY.lightingStyle,
    characterBible: [],
    propReferences: [],
  };
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function pickEnum<T extends string>(
  val: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  if (typeof val === 'string') {
    const normalized = val.trim().toLowerCase() as T;
    if (allowed.includes(normalized)) return normalized;
  }
  return fallback;
}

function cleanText(val: unknown, maxLen: number, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export function normalizeHexColor(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed.slice(0, 7).toLowerCase();
  }
  return fallback;
}

export function normalizeVisualContinuity(
  raw: unknown,
  fallback?: Partial<VisualContinuityBible> | null
): VisualContinuityBible {
  const base = fallback || EMPTY_VISUAL_CONTINUITY;
  const defaults: VisualContinuityBible = {
    artStyle: cleanText(base.artStyle, 160, EMPTY_VISUAL_CONTINUITY.artStyle),
    colorPalette:
      Array.isArray(base.colorPalette) && base.colorPalette.length >= 2
        ? base.colorPalette
            .slice(0, 8)
            .map((c, idx) =>
              normalizeHexColor(
                c,
                EMPTY_VISUAL_CONTINUITY.colorPalette[
                  idx % EMPTY_VISUAL_CONTINUITY.colorPalette.length
                ]
              )
            )
        : [...EMPTY_VISUAL_CONTINUITY.colorPalette],
    environmentRules: cleanText(
      base.environmentRules,
      280,
      EMPTY_VISUAL_CONTINUITY.environmentRules
    ),
    lightingStyle: cleanText(
      base.lightingStyle,
      160,
      EMPTY_VISUAL_CONTINUITY.lightingStyle
    ),
    characterBible: Array.isArray(base.characterBible) ? [...base.characterBible] : [],
    propReferences: Array.isArray(base.propReferences) ? [...base.propReferences] : [],
  };

  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;

  const rawPalette = Array.isArray(obj.colorPalette)
    ? obj.colorPalette
        .map((c) => normalizeHexColor(c, ''))
        .filter((c) => HEX_COLOR_REGEX.test(c))
    : [];
  const dedupedPalette =
    rawPalette.length > 0
      ? Array.from(new Set(rawPalette)).slice(0, 8)
      : [...defaults.colorPalette];
  while (dedupedPalette.length < 2) {
    const nextColor =
      defaults.colorPalette[dedupedPalette.length] ||
      EMPTY_VISUAL_CONTINUITY.colorPalette[dedupedPalette.length] ||
      '#38bdf8';
    if (!dedupedPalette.includes(nextColor)) {
      dedupedPalette.push(nextColor);
    } else {
      dedupedPalette.push('#e2e8f0');
    }
  }

  const rawChars = Array.isArray(obj.characterBible) ? obj.characterBible : null;
  const normalizedChars: CharacterBibleEntry[] = (rawChars ?? defaults.characterBible)
    .slice(0, 8)
    .map((entry, idx) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const name = cleanText(e.name, 60, '');
      if (!name) return null;
      return {
        name,
        role: cleanText(e.role, 80, `Character ${idx + 1}`),
        appearance: cleanText(e.appearance, 240, 'Consistent stylized silhouette'),
        primaryColor: normalizeHexColor(e.primaryColor, '#38bdf8'),
        secondaryColor: normalizeHexColor(e.secondaryColor, '#0f172a'),
      };
    })
    .filter((item): item is CharacterBibleEntry => item !== null);

  const rawProps = Array.isArray(obj.propReferences) ? obj.propReferences : null;
  const normalizedProps: string[] = (rawProps ?? defaults.propReferences)
    .slice(0, 12)
    .map((p) => cleanText(p, 80, ''))
    .filter((p) => p.length > 0);

  return {
    artStyle: cleanText(obj.artStyle, 160, defaults.artStyle),
    colorPalette: dedupedPalette,
    environmentRules: cleanText(obj.environmentRules, 280, defaults.environmentRules),
    lightingStyle: cleanText(obj.lightingStyle, 160, defaults.lightingStyle),
    characterBible: normalizedChars,
    propReferences: normalizedProps,
  };
}

export function isContinuityEstablished(
  continuity: VisualContinuityBible | null | undefined
): boolean {
  if (!continuity) return false;
  if (continuity.characterBible.length > 0 || continuity.propReferences.length > 0) {
    return true;
  }
  if (continuity.artStyle !== EMPTY_VISUAL_CONTINUITY.artStyle) {
    return true;
  }
  if (continuity.environmentRules !== EMPTY_VISUAL_CONTINUITY.environmentRules) {
    return true;
  }
  if (continuity.lightingStyle !== EMPTY_VISUAL_CONTINUITY.lightingStyle) {
    return true;
  }
  return false;
}

export function mergeVisualContinuity(
  previous: VisualContinuityBible | null | undefined,
  nextRaw: unknown
): VisualContinuityBible {
  const normalizedNext = normalizeVisualContinuity(nextRaw, previous);
  if (!previous || !isContinuityEstablished(previous)) {
    return normalizedNext;
  }

  const mergedMap = new Map<string, CharacterBibleEntry>();
  for (const ch of previous.characterBible) {
    mergedMap.set(ch.name.trim().toLowerCase(), ch);
  }
  for (const ch of normalizedNext.characterBible) {
    const key = ch.name.trim().toLowerCase();
    const prev = mergedMap.get(key);
    mergedMap.set(key, prev ? { ...prev, ...ch } : ch);
  }

  const mergedProps = Array.from(
    new Set([...previous.propReferences, ...normalizedNext.propReferences])
  ).slice(0, 12);

  return {
    ...normalizedNext,
    artStyle:
      normalizedNext.artStyle === EMPTY_VISUAL_CONTINUITY.artStyle &&
      previous.artStyle !== EMPTY_VISUAL_CONTINUITY.artStyle
        ? previous.artStyle
        : normalizedNext.artStyle,
    environmentRules:
      normalizedNext.environmentRules === EMPTY_VISUAL_CONTINUITY.environmentRules &&
      previous.environmentRules !== EMPTY_VISUAL_CONTINUITY.environmentRules
        ? previous.environmentRules
        : normalizedNext.environmentRules,
    lightingStyle:
      normalizedNext.lightingStyle === EMPTY_VISUAL_CONTINUITY.lightingStyle &&
      previous.lightingStyle !== EMPTY_VISUAL_CONTINUITY.lightingStyle
        ? previous.lightingStyle
        : normalizedNext.lightingStyle,
    characterBible: Array.from(mergedMap.values()).slice(0, 8),
    propReferences: mergedProps,
  };
}

const TRANSITION_MODES = ['cut', 'fade', 'pan-wipe'] as const;
const BG_MODES = ['scene', 'solid', 'transparent'] as const;
const CAMERA_MOTIONS = [
  'static',
  'pan-left',
  'pan-right',
  'zoom-in',
  'zoom-out',
  'follow-subject',
  'handheld-shake',
] as const;
const LIGHTING_MOODS = [
  'daylight',
  'cinematic',
  'neon',
  'noir',
  'golden-hour',
  'eerie-ash',
] as const;
const WEATHER_TYPES = [
  'none',
  'rain',
  'snow',
  'ash',
  'fog',
  'stars',
  'sparks',
] as const;
const ELEMENT_KINDS = [
  'skyline',
  'mountains',
  'trees',
  'clouds',
  'sun-moon',
  'grid-floor',
  'character',
  'creature',
  'vehicle',
  'drone',
  'planet',
  'chart',
  'text',
  'logo',
  'road',
  'particle-burst',
  'prop',
  'energy-ring',
  'light-beam',
  'building',
  'product',
  'procedural-mesh',
  'shader-fx',
  'external-asset',
  'custom',
] as const;
const ELEMENT_VARIANTS = [
  'running',
  'walking',
  'idle',
  'chasing',
  'hovering',
  'flying',
  'ruined',
  'glowing',
  'medieval',
  'futuristic',
  'organic',
  'cyberpunk',
  'tactical',
  'cinematic',
  'neon',
  'minimal',
  'armored',
] as const;
const MOTION_TYPES = [
  'static',
  'move-horizontal',
  'move-vertical',
  'bob',
  'orbit',
  'chase',
  'pulse',
  'pan-parallax',
] as const;

type ElementKind = (typeof ELEMENT_KINDS)[number];

function resolveElementKind(
  rawKind: unknown,
  label: string,
  hasValidCustomSpec = false
): ElementKind {
  if (typeof rawKind === 'string') {
    const k = rawKind.trim().toLowerCase();
    if (hasValidCustomSpec && (k === 'custom' || k === 'prop' || !(ELEMENT_KINDS as readonly string[]).includes(k))) {
      return 'custom';
    }
    if (k === 'custom' && !hasValidCustomSpec) {
      return 'prop';
    }
    if ((ELEMENT_KINDS as readonly string[]).includes(k)) {
      return k as ElementKind;
    }
    if (/\.glb|\.gltf|external[-_]?asset|external[-_]?model|uploaded[-_]?model|3d[-_]?asset/.test(k)) {
      return 'external-asset';
    }
    if (/shader|plasma|portal|hologram|vortex|ocean|water[-_]?wave|energy[-_]?field/.test(k)) {
      return 'shader-fx';
    }
    if (/procedural|ball|sphere|cube|torus|crystal|pyramid|icosahedron|mesh/.test(k)) {
      return 'procedural-mesh';
    }
    if (/chart|graph|plot|line-chart|bar-chart|area-chart|analytics|metric/.test(k)) {
      return 'chart';
    }
    if (/building|house|skyscraper|tower|architecture|doorway|shop|store|cabin|warehouse/.test(k)) {
      return 'building';
    }
    if (/product|watch|headphone|bottle|sneaker|phone|sculpture|showcase|gadget/.test(k)) {
      return 'product';
    }
    if (/drone|uav|quadcopter/.test(k)) return 'drone';
    if (/planet|star|sun|moon|orbit|celestial|asteroid|saturn|mars|earth/.test(k)) {
      return 'planet';
    }
    if (/logo|emblem|brand|crest|badge/.test(k)) return 'logo';
    if (/text|title|headline|subtitle|callout|label|typography|caption/.test(k)) {
      return 'text';
    }
    if (/road|highway|street|track|asphalt/.test(k)) return 'road';
    if (/car|race|racing|truck|bike|motorcycle|spaceship|helicopter|jet|aircraft|ship/.test(k)) {
      return 'vehicle';
    }
    if (/hero|person|human|survivor|ranger|soldier|warrior|cyborg|character|mech|giant|anime/.test(k)) {
      return 'character';
    }
    if (/zombie|monster|beast|alien|creature/.test(k)) return 'creature';
    if (/tree|forest|woods|pine/.test(k)) return 'trees';
    if (/mountain|peak|ridge|terrain|hill|island/.test(k)) return 'mountains';
    if (/particle|spark|burst|smoke|embers/.test(k)) return 'particle-burst';
  }

  if (hasValidCustomSpec) {
    return 'custom';
  }

  const lbl = label.toLowerCase();
  if (/\.(glb|gltf)\b/.test(lbl)) return 'external-asset';
  if (/\b(hologram|plasma|portal|ocean\s+waves?|shader)\b/.test(lbl)) return 'shader-fx';
  if (/\b(bouncing\s+ball|sphere|torus|crystal|icosahedron|spring\s+mass|pendulum)\b/.test(lbl)) {
    return 'procedural-mesh';
  }
  if (/\b(drone|quadcopter|uav)\b/.test(lbl)) return 'drone';
  if (/\b(revenue|growth|financial)\s*(graph|chart)\b/.test(lbl)) return 'chart';
  if (/\b(building|doorway|skyscraper|tower|house|cabin)\b/.test(lbl)) return 'building';
  if (/\b(watch|headphones|bottle|product|showcase)\b/.test(lbl)) return 'product';
  return 'prop';
}

function normalizeChartSpec(
  rawSpec: unknown,
  elObj: Record<string, unknown>,
  label: string
): ChartSpec | undefined {
  if (!rawSpec || typeof rawSpec !== 'object') return undefined;
  const s = rawSpec as Record<string, unknown>;
  const rawPoints = Array.isArray(s.points) ? s.points : [];
  const points: ChartPoint[] = rawPoints
    .slice(0, 16)
    .map((pt, idx) => {
      if (!pt || typeof pt !== 'object') return null;
      const p = pt as Record<string, unknown>;
      const val = Number(p.value);
      if (!Number.isFinite(val)) return null;
      return {
        label: cleanText(p.label, 24, `P${idx + 1}`),
        value: clampNum(val, -1_000_000_000, 1_000_000_000, 0),
      };
    })
    .filter((pt): pt is ChartPoint => pt !== null);

  if (points.length < 2) return undefined;

  return {
    chartType: pickEnum(s.chartType, ['line', 'area', 'bar'] as const, 'line'),
    title: cleanText(s.title, 100, label),
    xAxisLabel: cleanText(s.xAxisLabel, 40, ''),
    yAxisLabel: cleanText(s.yAxisLabel, 40, ''),
    valuePrefix: typeof s.valuePrefix === 'string' ? s.valuePrefix.slice(0, 8) : '',
    valueSuffix: typeof s.valueSuffix === 'string' ? s.valueSuffix.slice(0, 16) : '',
    smoothCurve: s.smoothCurve !== undefined ? Boolean(s.smoothCurve) : true,
    easing: pickEnum(s.easing, ['linear', 'accelerate', 'ease-out'] as const, 'accelerate'),
    showGrid: s.showGrid !== undefined ? Boolean(s.showGrid) : true,
    showAreaFill: s.showAreaFill !== undefined ? Boolean(s.showAreaFill) : true,
    showMovingMarker:
      s.showMovingMarker !== undefined ? Boolean(s.showMovingMarker) : true,
    highlightFinalBadge: cleanText(
      s.highlightFinalBadge,
      48,
      typeof elObj.accentText === 'string' ? elObj.accentText.slice(0, 48) : ''
    ),
    points,
  };
}

function inferColorKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bcrimson\b|\bscarlet\b|\bdark red\b/.test(lower)) return '#dc2626';
  if (/\bred\b/.test(lower)) return '#ef4444';
  if (/\bcyan\b|\baqua\b|\bturquoise\b/.test(lower)) return '#22d3ee';
  if (/\bgold\b|\bamber\b/.test(lower)) return '#f59e0b';
  if (/\bemerald\b|\bgreen\b/.test(lower)) return '#10b981';
  if (/\bpurple\b|\bviolet\b/.test(lower)) return '#a855f7';
  if (/\bmagenta\b|\bpink\b/.test(lower)) return '#ec4899';
  if (/\bblue\b|\bcobalt\b/.test(lower)) return '#3b82f6';
  if (/\bsilver\b|\bchrome\b|\bsteel\b/.test(lower)) return '#cbd5e1';
  return null;
}

export function hydrateCharacterSpec(
  rawSpec: unknown,
  el: {
    label: string;
    kind: string;
    variant: string;
    colorPrimary: string;
    colorSecondary: string;
    accentColor: string;
  },
  bibleEntry?: CharacterBibleEntry | null
): CharacterSpec {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  const desc = `${el.label} ${bibleEntry?.role || ''} ${bibleEntry?.appearance || ''}`.toLowerCase();
  const isCreature = el.kind === 'creature';

  const inferredArmorColor =
    (/\bcrimson\b|\bred\b/.test(desc) ? '#dc2626' : null) ||
    bibleEntry?.primaryColor ||
    el.colorPrimary;
  const inferredVisorColor =
    (/glowing\s+(cyan|aqua|blue)\s+visor/.test(desc)
      ? '#22d3ee'
      : /visor/.test(desc)
      ? inferColorKeyword(desc.slice(desc.indexOf('visor') - 20)) || el.accentColor
      : el.accentColor);

  const defaultArchetype: CharacterSpec['archetype'] = isCreature
    ? /\bzombie|undead\b/.test(desc)
      ? 'zombie'
      : 'beast'
    : /\branger\b/.test(desc)
    ? 'ranger'
    : /\bcyber|neon|hacker\b/.test(desc)
    ? 'cyberpunk'
    : /\bsoldier|trooper|marine\b/.test(desc)
    ? 'soldier'
    : /\bastronaut|cosmonaut\b/.test(desc)
    ? 'astronaut'
    : /\brobot|android|mech\b/.test(desc)
    ? 'robot'
    : /\bwizard|mage\b/.test(desc)
    ? 'wizard'
    : /\bsurvivor|wanderer|nomad\b/.test(desc)
    ? 'survivor'
    : 'citizen';

  const defaultPose: CharacterSpec['pose'] =
    el.variant === 'chasing'
      ? 'chasing'
      : el.variant === 'running'
      ? 'running'
      : el.variant === 'walking'
      ? 'walking'
      : el.variant === 'hovering' || el.variant === 'flying'
      ? 'floating'
      : 'idle';

  const defaultArmorStyle: CharacterSpec['armorStyle'] = isCreature
    ? 'none'
    : /\bheavy|plate|armor|ranger\b/.test(desc)
    ? 'tactical'
    : /\btrench|coat|detective\b/.test(desc)
    ? 'trench-coat'
    : /\bcyber|suit\b/.test(desc)
    ? 'cyber-suit'
    : /\bspace\b/.test(desc)
    ? 'spacesuit'
    : /\bhoodie|jacket\b/.test(desc)
    ? 'hoodie'
    : 'tactical';

  const defaultHeadgear: CharacterSpec['headgear'] = isCreature
    ? 'none'
    : /\bvisor\b/.test(desc)
    ? 'visor-helmet'
    : /\bhelmet\b/.test(desc)
    ? 'helmet'
    : /\bhood|cowl\b/.test(desc)
    ? 'hood'
    : /\bcyber\b/.test(desc)
    ? 'cyber-optics'
    : 'none';

  const defaultWeapon: CharacterSpec['weaponOrGear'] = isCreature
    ? 'none'
    : /\brifle|gun|blaster|carbine\b/.test(desc)
    ? 'rifle'
    : /\bsword|blade|katana\b/.test(desc)
    ? 'blade'
    : /\bumbrella\b/.test(desc)
    ? 'umbrella'
    : /\bshield\b/.test(desc)
    ? 'shield'
    : /\bbackpack|pack\b/.test(desc)
    ? 'backpack'
    : 'none';

  return {
    archetype: pickEnum(
      s.archetype,
      [
        'ranger',
        'survivor',
        'soldier',
        'cyberpunk',
        'citizen',
        'astronaut',
        'wizard',
        'robot',
        'zombie',
        'beast',
      ] as const,
      defaultArchetype
    ),
    pose: pickEnum(
      s.pose,
      [
        'running',
        'sprinting',
        'walking',
        'idle',
        'aiming',
        'combat',
        'floating',
        'chasing',
      ] as const,
      defaultPose
    ),
    expression: pickEnum(
      s.expression,
      ['determined', 'alert', 'calm', 'fierce', 'hollow'] as const,
      isCreature ? 'hollow' : 'determined'
    ),
    armorStyle: pickEnum(
      s.armorStyle,
      [
        'none',
        'tactical',
        'heavy-plate',
        'cyber-suit',
        'trench-coat',
        'hoodie',
        'spacesuit',
      ] as const,
      defaultArmorStyle
    ),
    armorColor: normalizeHexColor(s.armorColor, inferredArmorColor),
    secondaryGearColor: normalizeHexColor(
      s.secondaryGearColor,
      bibleEntry?.secondaryColor || el.colorSecondary
    ),
    headgear: pickEnum(
      s.headgear,
      [
        'none',
        'helmet',
        'visor-helmet',
        'hood',
        'cap',
        'cyber-optics',
        'crown',
      ] as const,
      defaultHeadgear
    ),
    visorColor: normalizeHexColor(s.visorColor, inferredVisorColor),
    cloakOrCoat:
      s.cloakOrCoat !== undefined
        ? Boolean(s.cloakOrCoat)
        : /\bcloak|cape|coat|ranger|trench\b/.test(desc),
    cloakColor: normalizeHexColor(s.cloakColor, el.colorSecondary),
    weaponOrGear: pickEnum(
      s.weaponOrGear,
      [
        'none',
        'rifle',
        'blade',
        'scanner',
        'backpack',
        'briefcase',
        'umbrella',
        'shield',
      ] as const,
      defaultWeapon
    ),
    hairColor: normalizeHexColor(s.hairColor, '#1e293b'),
    detailLevel: pickEnum(
      s.detailLevel,
      ['standard', 'high', 'hero'] as const,
      isCreature ? 'standard' : 'high'
    ),
  };
}

function normalizeVehicleSpec(
  rawSpec: unknown,
  rawKind: unknown,
  label: string
): VehicleSpec {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  const hint = `${String(rawKind || '')} ${label}`.toLowerCase();
  const inferredSubKind: VehicleSpec['subKind'] = /\b(race|racing|f1|formula|rally|gt)\b/.test(hint)
    ? 'racing-car'
    : /\b(cyber|futur)/.test(hint) && /\b(car|sedan|coupe)\b/.test(hint)
    ? 'cyber-car'
    : /\b(bicycle|motorbike|motorcycle|bike|scooter)\b|cycle/.test(hint)
    ? 'hover-bike'
    : /\b(car|coupe|supercar|sports|sedan)\b/.test(hint)
    ? 'sports-car'
    : /\b(truck|rig|van)\b/.test(hint)
    ? 'truck'
    : /\b(heli|helicopter|chopper)\b/.test(hint)
    ? 'helicopter'
    : /\b(ufo|saucer)\b/.test(hint)
    ? 'ufo'
    : 'spaceship';

  const subKind = pickEnum(
    s.subKind,
    [
      'racing-car',
      'sports-car',
      'cyber-car',
      'truck',
      'hover-bike',
      'spaceship',
      'helicopter',
      'ufo',
    ] as const,
    inferredSubKind
  );
  const isCar =
    subKind === 'racing-car' ||
    subKind === 'sports-car' ||
    subKind === 'cyber-car' ||
    subKind === 'truck';

  return {
    subKind,
    speedLines: s.speedLines !== undefined ? Boolean(s.speedLines) : true,
    headlights: s.headlights !== undefined ? Boolean(s.headlights) : isCar,
    exhaustFlame:
      s.exhaustFlame !== undefined
        ? Boolean(s.exhaustFlame)
        : subKind === 'racing-car' || subKind === 'spaceship',
    wheelSpin: s.wheelSpin !== undefined ? Boolean(s.wheelSpin) : isCar,
    numberTag: cleanText(s.numberTag, 10, ''),
  };
}

function normalizeDroneSpec(
  rawSpec: unknown,
  el: { accentColor: string }
): DroneSpec {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  return {
    rotorCount: Math.round(clampNum(s.rotorCount, 2, 6, 4)),
    hasSearchlight: s.hasSearchlight !== undefined ? Boolean(s.hasSearchlight) : true,
    searchlightColor: normalizeHexColor(s.searchlightColor, el.accentColor),
    searchlightAngleDeg: clampNum(s.searchlightAngleDeg, -85, 85, 18),
    statusLedColor: normalizeHexColor(s.statusLedColor, '#ef4444'),
  };
}

function normalizePlanetSpec(
  rawSpec: unknown,
  label: string,
  el: { x: number; y: number; colorPrimary: string; accentColor: string }
): PlanetSpec {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  const lbl = label.toLowerCase();
  const isStar = /\bsun\b|\bsolar\s+core\b|\bstar\b/.test(lbl);
  const bodyRole = pickEnum(
    s.bodyRole,
    ['star', 'planet', 'moon', 'dwarf'] as const,
    isStar ? 'star' : /\bmoon\b/.test(lbl) ? 'moon' : 'planet'
  );
  const dx = el.x - 0.5;
  const dy = el.y - 0.5;
  const defaultRx = bodyRole === 'star' ? 0 : clampNum(Math.hypot(dx, dy) || 0.22, 0.06, 0.46, 0.22);

  return {
    bodyRole,
    radiusScale: clampNum(s.radiusScale, 0.15, 3.5, bodyRole === 'star' ? 1.65 : 1),
    hasRings:
      s.hasRings !== undefined ? Boolean(s.hasRings) : /\bsaturn|ringed\b/.test(lbl),
    ringColor: normalizeHexColor(s.ringColor, el.accentColor),
    orbitCenterX: clampNum(s.orbitCenterX, -0.2, 1.2, 0.5),
    orbitCenterY: clampNum(s.orbitCenterY, -0.2, 1.2, 0.5),
    orbitRadiusX: clampNum(s.orbitRadiusX, 0, 0.75, defaultRx),
    orbitRadiusY: clampNum(s.orbitRadiusY, 0, 0.6, defaultRx * 0.56),
    orbitStartAngle: clampNum(s.orbitStartAngle, -6.3, 6.3, Math.atan2(dy, dx) || 0),
    showOrbitPath:
      s.showOrbitPath !== undefined ? Boolean(s.showOrbitPath) : bodyRole !== 'star',
    showLabel: s.showLabel !== undefined ? Boolean(s.showLabel) : true,
    surfaceStyle: pickEnum(
      s.surfaceStyle,
      ['rocky', 'gas-bands', 'earth-like', 'molten', 'icy', 'sun-corona'] as const,
      bodyRole === 'star'
        ? 'sun-corona'
        : /\bearth\b/.test(lbl)
        ? 'earth-like'
        : /\bjupiter|saturn|gas\b/.test(lbl)
        ? 'gas-bands'
        : /\bneptune|uranus|ice|pluto\b/.test(lbl)
        ? 'icy'
        : /\bmars|venus|lava|mercury\b/.test(lbl)
        ? 'molten'
        : 'rocky'
    ),
  };
}

function normalizeTextSpec(rawSpec: unknown, label: string): TextSpec {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  return {
    text: cleanText(s.text, 160, label),
    subtext: typeof s.subtext === 'string' ? s.subtext.trim().slice(0, 160) : '',
    fontSize: pickEnum(s.fontSize, ['sm', 'md', 'lg', 'xl', 'hero'] as const, 'lg'),
    align: pickEnum(s.align, ['left', 'center', 'right'] as const, 'center'),
    revealEffect: pickEnum(
      s.revealEffect,
      ['none', 'fade-in', 'slide-up', 'typewriter', 'scale-pop', 'glow-pulse'] as const,
      'fade-in'
    ),
    showBackdrop: s.showBackdrop !== undefined ? Boolean(s.showBackdrop) : false,
  };
}

function normalizeLogoSpec(rawSpec: unknown, label: string): LogoSpec {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  return {
    brandText: cleanText(s.brandText, 60, label),
    tagline: typeof s.tagline === 'string' ? s.tagline.trim().slice(0, 100) : '',
    emblemShape: pickEnum(
      s.emblemShape,
      [
        'shield',
        'hexagon',
        'diamond',
        'wing-v',
        'orbit',
        'circuit',
        'prism',
        'crown',
      ] as const,
      'wing-v'
    ),
    revealStyle: pickEnum(
      s.revealStyle,
      ['wipe', 'assemble', 'burst', 'pulse-draw'] as const,
      'assemble'
    ),
  };
}

function normalizeRoadSpec(rawSpec: unknown, variant: string): RoadSpec {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  return {
    perspective: pickEnum(
      s.perspective,
      ['flat', 'perspective', 'wet-neon'] as const,
      variant === 'cyberpunk' || variant === 'neon' ? 'wet-neon' : 'flat'
    ),
    lanes: Math.round(clampNum(s.lanes, 1, 6, 2)),
    scrollSpeed: clampNum(s.scrollSpeed, -5, 5, 2),
    wetReflections:
      s.wetReflections !== undefined
        ? Boolean(s.wetReflections)
        : variant === 'cyberpunk' || variant === 'neon',
  };
}

function normalizeVector3(
  raw: unknown,
  fallback: Vector3Spec,
  bounds: { min: number; max: number } = { min: -500, max: 500 }
): Vector3Spec {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const v = raw as Record<string, unknown>;
  return {
    x: clampNum(v.x, bounds.min, bounds.max, fallback.x),
    y: clampNum(v.y, bounds.min, bounds.max, fallback.y),
    z: clampNum(v.z, bounds.min, bounds.max, fallback.z),
  };
}

function normalizeBuildingSpec3D(
  rawSpec: unknown,
  label: string,
  variant: string,
  accentColor: string
): BuildingSpec3D {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  const lbl = `${label} ${variant}`.toLowerCase();
  const hasDoorHint = /\bdoor|doorway|entrance|entry|portal|lobby|walk\s*in\b/.test(lbl);
  return {
    floors: Math.round(clampNum(s.floors, 1, 40, hasDoorHint ? 2 : 8)),
    style: pickEnum(
      s.style,
      ['modern-glass', 'concrete', 'ruined', 'neon-tower', 'cottage', 'warehouse'] as const,
      variant === 'ruined'
        ? 'ruined'
        : variant === 'cyberpunk' || variant === 'neon'
        ? 'neon-tower'
        : hasDoorHint
        ? 'concrete'
        : 'modern-glass'
    ),
    hasDoorway: s.hasDoorway !== undefined ? Boolean(s.hasDoorway) : hasDoorHint,
    doorwaySide: pickEnum(
      s.doorwaySide,
      ['front', 'back', 'left', 'right'] as const,
      'front'
    ),
    doorwayWidth: clampNum(s.doorwayWidth, 1, 8, 2.2),
    doorwayHeight: clampNum(s.doorwayHeight, 2, 8, 3.0),
    doorwayOpen: s.doorwayOpen !== undefined ? Boolean(s.doorwayOpen) : true,
    interiorLit: s.interiorLit !== undefined ? Boolean(s.interiorLit) : true,
    interiorColor: normalizeHexColor(s.interiorColor, accentColor || '#fde68a'),
  };
}

function normalizeProductSpec3D(
  rawSpec: unknown,
  label: string
): ProductSpec3D {
  const s =
    rawSpec && typeof rawSpec === 'object'
      ? (rawSpec as Record<string, unknown>)
      : {};
  const lbl = label.toLowerCase();
  const inferredType: ProductSpec3D['productType'] = /\bwatch|chronograph|timepiece\b/.test(lbl)
    ? 'watch'
    : /\bheadphone|earcup|audio\b/.test(lbl)
    ? 'headphones'
    : /\bbottle|perfume|fragrance|flask\b/.test(lbl)
    ? 'bottle'
    : /\bsneaker|shoe\b/.test(lbl)
    ? 'sneaker'
    : /\bphone|smartphone|device\b/.test(lbl)
    ? 'phone'
    : /\bcar|model|coupe\b/.test(lbl)
    ? 'car-model'
    : 'orb-sculpture';

  const inferredFinish: ProductSpec3D['materialFinish'] = /\bglass|crystal|perfume\b/.test(lbl)
    ? 'glass'
    : /\bgold|brass\b/.test(lbl)
    ? 'gold'
    : /\bchrome|mirror\b/.test(lbl)
    ? 'chrome'
    : /\bcarbon\b/.test(lbl)
    ? 'carbon'
    : /\bmatte|ceramic\b/.test(lbl)
    ? 'matte-ceramic'
    : 'brushed-metal';

  return {
    productType: pickEnum(
      s.productType,
      ['watch', 'headphones', 'bottle', 'sneaker', 'phone', 'orb-sculpture', 'car-model'] as const,
      inferredType
    ),
    materialFinish: pickEnum(
      s.materialFinish,
      ['brushed-metal', 'chrome', 'glass', 'carbon', 'gold', 'matte-ceramic'] as const,
      inferredFinish
    ),
    hasPedestal: s.hasPedestal !== undefined ? Boolean(s.hasPedestal) : true,
    turntableSpin: s.turntableSpin !== undefined ? Boolean(s.turntableSpin) : false,
  };
}

function defaultPos3DFromElement(el: {
  kind: ElementKind;
  x: number;
  y: number;
  depth: number;
  scale: number;
}): Vector3Spec {
  const x3d = clampNum((el.x - 0.5) * 28, -120, 120, 0);
  const z3d = clampNum(12 - (1 - el.depth) * 48, -120, 40, 0);
  let y3d = 0;
  if (el.kind === 'drone') y3d = 5.5;
  else if (el.kind === 'clouds') y3d = 18;
  else if (el.kind === 'sun-moon') y3d = 35;
  else if (el.kind === 'planet') y3d = 2;
  else if (el.kind === 'vehicle' && el.scale > 0 && el.y < 0.45) y3d = 4;
  return { x: Number(x3d.toFixed(2)), y: y3d, z: Number(z3d.toFixed(2)) };
}

function normalizeScene3DConfig(
  raw: unknown,
  seg: {
    background: SceneSegment['background'];
    camera: SceneSegment['camera'];
    lighting: SceneSegment['lighting'];
    weather: SceneSegment['weather'];
    elements: SceneElement[];
  }
): Scene3DConfig {
  const s =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const hasPlanet = seg.elements.some((e) => e.kind === 'planet');
  const hasTrees = seg.elements.some((e) => e.kind === 'trees');
  const hasProduct = seg.elements.some((e) => e.kind === 'product');
  const hasRoad = seg.elements.some((e) => e.kind === 'road');
  const hasVehicle = seg.elements.some((e) => e.kind === 'vehicle');
  const hasBuilding = seg.elements.some(
    (e) => e.kind === 'building' || e.kind === 'skyline'
  );

  const defaultEnv: Scene3DConfig['environment'] = hasPlanet
    ? 'space'
    : hasProduct
    ? 'studio'
    : hasTrees && !hasBuilding
    ? 'forest'
    : hasRoad && hasVehicle && !hasBuilding
    ? 'racetrack'
    : hasBuilding && hasRoad
    ? 'street'
    : hasBuilding
    ? 'city'
    : seg.lighting.mood === 'eerie-ash'
    ? 'wasteland'
    : 'street';

  const environment = pickEnum(
    s.environment,
    ['city', 'street', 'forest', 'space', 'racetrack', 'studio', 'interior', 'wasteland'] as const,
    defaultEnv
  );

  const defaultGroundType: Scene3DConfig['groundType'] =
    environment === 'space'
      ? 'none'
      : environment === 'studio'
      ? 'studio-floor'
      : environment === 'forest'
      ? 'grass'
      : environment === 'racetrack'
      ? 'track'
      : environment === 'city' || environment === 'street'
      ? 'asphalt'
      : 'dirt';

  const rawCam =
    s.camera3d && typeof s.camera3d === 'object'
      ? (s.camera3d as Record<string, unknown>)
      : {};

  const PRIMARY_SUBJECT_KINDS = new Set<ElementKind>([
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
  const DECOR_KINDS = new Set<ElementKind>([
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

  const primaryActors = seg.elements.filter((e) => PRIMARY_SUBJECT_KINDS.has(e.kind));
  const buildings = seg.elements.filter((e) => e.kind === 'building');
  const fallbackProps = seg.elements.filter(
    (e) => !DECOR_KINDS.has(e.kind) && e.kind !== 'building'
  );
  const subjectElements =
    primaryActors.length > 0
      ? primaryActors
      : buildings.length > 0
      ? buildings
      : fallbackProps.length > 0
      ? fallbackProps
      : seg.elements;

  const customHeroEl = seg.elements.find(
    (e) => e.kind === 'custom' && Boolean(e.customModelSpec?.parts.length)
  );
  const heroTargetEl =
    customHeroEl ||
    primaryActors[0] ||
    buildings[0] ||
    subjectElements[0] ||
    seg.elements[0];
  const heroPos = heroTargetEl?.pos3d || { x: 0, y: 0, z: 0 };

  const defaultCamMotion: Camera3DSpec['motion'] =
    environment === 'studio'
      ? 'orbit'
      : seg.camera.motion === 'zoom-in'
      ? 'dolly-in'
      : seg.camera.motion === 'zoom-out'
      ? 'dolly-out'
      : seg.camera.motion === 'follow-subject'
      ? 'follow-subject'
      : seg.camera.motion === 'pan-left' || seg.camera.motion === 'pan-right'
      ? 'pan'
      : 'static';

  const shotType = pickEnum(
    rawCam.shotType,
    [
      'wide',
      'close-up',
      'extreme-close-up',
      'low-angle',
      'high-angle',
      'birds-eye',
      'over-the-shoulder',
      'tracking',
      'orbit',
      'custom',
    ] as const,
    environment === 'studio' ? 'orbit' : 'wide'
  );

  const resolvedFov = clampNum(rawCam.fov, 18, 110, shotType === 'wide' ? 52 : 46);

  const estimateElementBounds = (el: SceneElement) => {
    const px = el.pos3d?.x ?? 0;
    const py = el.pos3d?.y ?? 0;
    const pz = el.pos3d?.z ?? 0;
    const sc = Math.max(0.2, el.scale || 1);

    let w = el.size3d?.w ?? 0;
    let h = el.size3d?.h ?? 0;
    let d = el.size3d?.d ?? 0;
    let centeredY = false;

    if (el.kind === 'custom' && el.customModelSpec) {
      if (!el.size3d) {
        let mMinX = Infinity;
        let mMaxX = -Infinity;
        let mMinY = Infinity;
        let mMaxY = -Infinity;
        let mMinZ = Infinity;
        let mMaxZ = -Infinity;
        for (const p of el.customModelSpec.parts) {
          mMinX = Math.min(mMinX, (p.px - p.sx * 0.5) * sc);
          mMaxX = Math.max(mMaxX, (p.px + p.sx * 0.5) * sc);
          mMinY = Math.min(mMinY, (p.py - p.sy * 0.5) * sc);
          mMaxY = Math.max(mMaxY, (p.py + p.sy * 0.5) * sc);
          mMinZ = Math.min(mMinZ, (p.pz - p.sz * 0.5) * sc);
          mMaxZ = Math.max(mMaxZ, (p.pz + p.sz * 0.5) * sc);
        }
        w = Number.isFinite(mMaxX - mMinX) ? Math.max(0.2, mMaxX - mMinX) : 2;
        h = Number.isFinite(mMaxY - mMinY) ? Math.max(0.2, mMaxY - mMinY) : 2;
        d = Number.isFinite(mMaxZ - mMinZ) ? Math.max(0.2, mMaxZ - mMinZ) : 2;
      }
    } else if (el.kind === 'character' || el.kind === 'creature') {
      const isRobot = el.characterSpec?.archetype === 'robot';
      const charH = el.size3d?.h ?? (isRobot ? 2.4 : 1.85) * sc;
      const ratio = charH / (isRobot ? 2.4 : 1.85);
      w = el.size3d?.w ?? (isRobot ? 1.4 : 0.85) * ratio;
      h = charH;
      d = el.size3d?.d ?? (isRobot ? 0.9 : 0.65) * ratio;
    } else if (el.kind === 'vehicle') {
      const sub = el.vehicleSpec?.subKind;
      if (sub === 'hover-bike') {
        w = w || 0.7 * sc;
        h = h || 1.2 * sc;
        d = d || 2.3 * sc;
      } else if (sub === 'spaceship') {
        w = w || 5.0 * sc;
        h = h || 1.4 * sc;
        d = d || 5.2 * sc;
        centeredY = true;
      } else if (sub === 'ufo') {
        w = w || 4.4 * sc;
        h = h || 1.4 * sc;
        d = d || 4.4 * sc;
        centeredY = true;
      } else if (sub === 'truck') {
        w = w || 2.1 * sc;
        h = h || 2.1 * sc;
        d = d || 5.2 * sc;
      } else {
        w = w || 2.0 * sc;
        h = h || 1.6 * sc;
        d = d || 4.6 * sc;
      }
    } else if (el.kind === 'building') {
      const hasDoor = Boolean(el.buildingSpec3d?.hasDoorway);
      const floors = el.buildingSpec3d?.floors ?? 6;
      w = w || (hasDoor ? 8.5 : 5.5 * sc);
      h = h || Math.max(4.5, floors * (hasDoor ? 3.2 : 3.4));
      d = d || (hasDoor ? 8.5 : 5.5 * sc);
    } else if (el.kind === 'planet') {
      const r = Math.max(1.2, 4.2 * (el.planetSpec?.radiusScale ?? 1) * sc);
      const span = r * (el.planetSpec?.hasRings ? 2.1 : 1.08) * 2;
      w = w || span;
      h = h || r * 2.16;
      d = d || span;
      centeredY = true;
    } else if (el.kind === 'product') {
      w = w || 3.4 * sc;
      h = h || 2.8 * sc;
      d = d || 3.4 * sc;
    } else if (el.kind === 'drone') {
      w = w || 2.2 * sc;
      h = h || 1.0 * sc;
      d = d || 2.2 * sc;
      centeredY = true;
    } else {
      w = w || 1.6 * sc;
      h = h || 1.6 * sc;
      d = d || 1.6 * sc;
    }

    return {
      minX: px - w * 0.5,
      maxX: px + w * 0.5,
      minY: centeredY ? py - h * 0.5 : py,
      maxY: centeredY ? py + h * 0.5 : py + h,
      minZ: pz - d * 0.5,
      maxZ: pz + d * 0.5,
    };
  };

  let unionMinX = Infinity;
  let unionMaxX = -Infinity;
  let unionMinY = Infinity;
  let unionMaxY = -Infinity;
  let unionMinZ = Infinity;
  let unionMaxZ = -Infinity;
  for (const el of subjectElements) {
    const b = estimateElementBounds(el);
    unionMinX = Math.min(unionMinX, b.minX);
    unionMaxX = Math.max(unionMaxX, b.maxX);
    unionMinY = Math.min(unionMinY, b.minY);
    unionMaxY = Math.max(unionMaxY, b.maxY);
    unionMinZ = Math.min(unionMinZ, b.minZ);
    unionMaxZ = Math.max(unionMaxZ, b.maxZ);
  }

  let defaultTarget: Vector3Spec = {
    x: heroPos.x,
    y: Math.max(0.8, heroPos.y + (heroTargetEl?.kind === 'character' ? 0.95 : 0.7)),
    z: heroPos.z,
  };
  let defaultPos: Vector3Spec =
    environment === 'space'
      ? { x: 0, y: 6, z: 22 }
      : environment === 'studio'
      ? { x: 3.5, y: 2.0, z: 5.0 }
      : { x: heroPos.x + 1.6, y: Math.max(1.4, heroPos.y + 1.3), z: heroPos.z + 4.8 };
  let computedOrbitRadius = environment === 'studio' ? 5.5 : 8.5;

  if (Number.isFinite(unionMinX) && Number.isFinite(unionMaxY)) {
    const boxW = Math.max(0.4, unionMaxX - unionMinX);
    const boxH = Math.max(0.4, unionMaxY - unionMinY);
    const boxD = Math.max(0.4, unionMaxZ - unionMinZ);
    defaultTarget = {
      x: Number(((unionMinX + unionMaxX) * 0.5).toFixed(2)),
      y: Number(((unionMinY + unionMaxY) * 0.5).toFixed(2)),
      z: Number(((unionMinZ + unionMaxZ) * 0.5).toFixed(2)),
    };

    const rawDirVec =
      shotType === 'low-angle'
        ? [0.48, 0.06, 0.87]
        : shotType === 'high-angle'
        ? [0.48, 0.62, 0.62]
        : shotType === 'birds-eye'
        ? [0.15, 0.92, 0.36]
        : [0.65, 0.28, 0.7];
    const dLen = Math.hypot(rawDirVec[0], rawDirVec[1], rawDirVec[2]) || 1;
    const dx = rawDirVec[0] / dLen;
    const dy = rawDirVec[1] / dLen;
    const dz = rawDirVec[2] / dLen;
    const rLen = Math.hypot(dz, 0, -dx) || 1;
    const rx = dz / rLen;
    const rz = -dx / rLen;
    const ux = dy * rz;
    const uy = dz * rx - dx * rz;
    const uz = -dy * rx;

    const projHalfW = Math.abs(rx) * (boxW * 0.5) + Math.abs(rz) * (boxD * 0.5);
    const projHalfH =
      Math.abs(ux) * (boxW * 0.5) + Math.abs(uy) * (boxH * 0.5) + Math.abs(uz) * (boxD * 0.5);
    const projHalfDepth =
      Math.abs(dx) * (boxW * 0.5) + Math.abs(dy) * (boxH * 0.5) + Math.abs(dz) * (boxD * 0.5);

    const tanHalf = Math.tan((resolvedFov * Math.PI) / 360);
    const aspect = 16 / 9;
    const fill =
      shotType === 'extreme-close-up'
        ? 0.78
        : shotType === 'close-up'
        ? 0.66
        : 0.52;
    const distV = projHalfH / (fill * tanHalf);
    const distH = projHalfW / (fill * tanHalf * aspect);
    const minDist = customHeroEl ? 0.25 : 2.0;
    const dist = Math.max(minDist, Math.max(distV, distH) + projHalfDepth * 0.35);

    computedOrbitRadius = Math.max(1.0, Math.min(160, Number(dist.toFixed(2))));
    defaultPos = {
      x: Number((defaultTarget.x + dx * dist).toFixed(2)),
      y: Number(Math.max(0.5, defaultTarget.y + dy * dist).toFixed(2)),
      z: Number((defaultTarget.z + dz * dist).toFixed(2)),
    };
  }

  const camera3d: Camera3DSpec = {
    projection: pickEnum(
      rawCam.projection,
      ['perspective', 'orthographic'] as const,
      'perspective'
    ),
    shotType,
    fov: resolvedFov,
    position: normalizeVector3(rawCam.position, defaultPos),
    target: normalizeVector3(rawCam.target, defaultTarget),
    motion: pickEnum(
      rawCam.motion,
      [
        'static',
        'dolly-in',
        'dolly-out',
        'orbit',
        'pan',
        'tilt',
        'follow-subject',
        'tracking',
        'flythrough',
      ] as const,
      defaultCamMotion
    ),
    orbitRadius: clampNum(rawCam.orbitRadius, 1, 160, computedOrbitRadius),
    orbitSpeed: clampNum(rawCam.orbitSpeed, -4, 4, environment === 'studio' ? 0.65 : 0.35),
  };

  if (rawCam.endPosition && typeof rawCam.endPosition === 'object') {
    camera3d.endPosition = normalizeVector3(rawCam.endPosition, camera3d.position);
  }
  if (rawCam.endTarget && typeof rawCam.endTarget === 'object') {
    camera3d.endTarget = normalizeVector3(rawCam.endTarget, camera3d.target);
  }
  if (typeof rawCam.followElementId === 'string' && rawCam.followElementId.trim()) {
    camera3d.followElementId = rawCam.followElementId.trim().slice(0, 64);
  }
  if (rawCam.followOffset && typeof rawCam.followOffset === 'object') {
    camera3d.followOffset = normalizeVector3(rawCam.followOffset, { x: 4, y: 3, z: 9 });
  }

  return {
    environment,
    groundType: pickEnum(
      s.groundType,
      ['asphalt', 'grass', 'dirt', 'studio-floor', 'grid', 'track', 'none'] as const,
      defaultGroundType
    ),
    groundSize: clampNum(s.groundSize, 20, 600, 180),
    fogColor: normalizeHexColor(s.fogColor, seg.background.horizonColor || '#0f172a'),
    fogDensity: clampNum(
      s.fogDensity,
      0,
      0.08,
      seg.weather.type === 'fog'
        ? 0.024
        : environment === 'space' || environment === 'studio'
        ? 0
        : 0.008
    ),
    sunElevationDeg: clampNum(
      s.sunElevationDeg,
      2,
      90,
      seg.lighting.mood === 'golden-hour' ? 16 : seg.lighting.mood === 'noir' ? 28 : 44
    ),
    sunAzimuthDeg: clampNum(s.sunAzimuthDeg, -180, 180, 38),
    sunIntensity: clampNum(
      s.sunIntensity,
      0,
      5,
      seg.lighting.mood === 'daylight' ? 2.4 : 1.7
    ),
    ambientIntensity: clampNum(
      s.ambientIntensity,
      0,
      2.5,
      Math.max(0.35, seg.lighting.ambientAlpha * 2.2)
    ),
    camera3d,
  };
}

function normalizePhysicsSpec(rawSpec: unknown): PhysicsSpec | undefined {
  if (!rawSpec || typeof rawSpec !== 'object') return undefined;
  const s = rawSpec as Record<string, unknown>;
  const mode = pickEnum(s.mode, PHYSICS_MODES, 'none');
  if (mode === 'none') return undefined;
  const out: PhysicsSpec = {
    mode,
    gravity: clampNum(s.gravity, -50, 50, 9.81),
    restitution: clampNum(s.restitution, 0, 0.98, 0.78),
    damping: clampNum(s.damping, 0, 5, 0.35),
    springK: clampNum(s.springK, 0.5, 80, 12),
    amplitude: clampNum(s.amplitude, 0, 30, 2.5),
    groundY: clampNum(s.groundY, -20, 20, 0),
    squashStretch: s.squashStretch !== undefined ? Boolean(s.squashStretch) : true,
  };
  if (s.initialVelocity && typeof s.initialVelocity === 'object') {
    out.initialVelocity = normalizeVector3(
      s.initialVelocity,
      { x: 0, y: 0, z: 0 },
      { min: -100, max: 100 }
    );
  }
  return out;
}

function normalizeShaderSpec(
  rawSpec: unknown,
  el: { colorPrimary: string; accentColor: string }
): ShaderSpec | undefined {
  if (!rawSpec || typeof rawSpec !== 'object') return undefined;
  const s = rawSpec as Record<string, unknown>;
  const preset = pickEnum(s.preset, SHADER_PRESETS, 'none');
  if (preset === 'none') return undefined;
  return {
    preset,
    primaryColor: normalizeHexColor(s.primaryColor, el.colorPrimary),
    secondaryColor: normalizeHexColor(s.secondaryColor, el.accentColor),
    speed: clampNum(s.speed, -5, 5, 1.2),
    intensity: clampNum(s.intensity, 0.1, 5, 1.4),
  };
}

function normalizeAssetRef(rawSpec: unknown): AssetRefSpec | undefined {
  if (!rawSpec || typeof rawSpec !== 'object') return undefined;
  const s = rawSpec as Record<string, unknown>;
  const format = pickEnum(s.format, ['glb', 'gltf', 'svg', 'image'] as const, 'glb');
  const out: AssetRefSpec = { format };

  if (typeof s.storagePath === 'string') {
    const clean = s.storagePath.trim();
    if (/^[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9._-]{1,200}$/.test(clean) && !clean.includes('..')) {
      out.storagePath = clean;
    }
  }
  if (typeof s.inlineDataUri === 'string') {
    const uri = s.inlineDataUri.trim();
    if (
      uri.length <= 2_000_000 &&
      /^data:(?:model\/gltf-binary;base64,|model\/gltf\+json;(?:base64|charset=[^,]+)?,|image\/(?:png|jpeg|webp);base64,)/i.test(
        uri
      )
    ) {
      out.inlineDataUri = uri;
    }
  }
  if (s.normalizeHeight !== undefined) {
    out.normalizeHeight = clampNum(s.normalizeHeight, 0.2, 100, 2.2);
  }
  if (!out.storagePath && !out.inlineDataUri) return undefined;
  return out;
}

export function normalizeCustomModelSpec(
  rawSpec: unknown,
  fallbackLabel = 'Custom 3D Model'
): CustomModelSpec | undefined {
  if (!rawSpec || typeof rawSpec !== 'object' || Array.isArray(rawSpec)) {
    return undefined;
  }
  const s = rawSpec as Record<string, unknown>;
  const rawParts = Array.isArray(s.parts) ? s.parts : [];
  const parts: CustomModelPart[] = [];

  const isExplicitBadNumber = (val: unknown): boolean => {
    if (val === undefined) return false;
    if (val === null || typeof val === 'boolean' || typeof val === 'object') return true;
    const n = typeof val === 'number' ? val : Number(val);
    return !Number.isFinite(n);
  };

  for (let i = 0; i < Math.min(120, rawParts.length) && parts.length < 40; i++) {
    const rawPart = rawParts[i];
    if (!rawPart || typeof rawPart !== 'object' || Array.isArray(rawPart)) continue;
    const p = rawPart as Record<string, unknown>;
    const rawShape =
      typeof p.shape === 'string' ? p.shape.trim().toLowerCase() : '';
    if (!(CUSTOM_MODEL_SHAPES as readonly string[]).includes(rawShape)) {
      // Strictly reject unknown shapes (never coerce unknown shapes)
      continue;
    }
    if (
      isExplicitBadNumber(p.px) ||
      isExplicitBadNumber(p.py) ||
      isExplicitBadNumber(p.pz) ||
      isExplicitBadNumber(p.sx) ||
      isExplicitBadNumber(p.sy) ||
      isExplicitBadNumber(p.sz)
    ) {
      // Drop malformed parts with non-numeric position/scale values
      continue;
    }

    const posObj =
      p.position && typeof p.position === 'object'
        ? (p.position as Record<string, unknown>)
        : null;
    const rotObj =
      p.rotationDeg && typeof p.rotationDeg === 'object'
        ? (p.rotationDeg as Record<string, unknown>)
        : null;
    const scaleObj =
      p.scale && typeof p.scale === 'object'
        ? (p.scale as Record<string, unknown>)
        : null;
    const matObj =
      p.material && typeof p.material === 'object'
        ? (p.material as Record<string, unknown>)
        : null;
    const moObj =
      p.motion && typeof p.motion === 'object'
        ? (p.motion as Record<string, unknown>)
        : null;

    const rawEmissive = p.emissive ?? matObj?.emissive;
    const rawEmissiveIntensity = p.emissiveIntensity ?? matObj?.emissiveIntensity;
    const emissiveHex =
      typeof rawEmissive === 'string' ? normalizeHexColor(rawEmissive, '') : '';
    const hasEmissive = HEX_COLOR_REGEX.test(emissiveHex);

    const motionType = pickEnum(
      p.motionType ?? moObj?.type,
      CUSTOM_PART_MOTION_TYPES,
      'none'
    );
    const motionAxis = pickEnum(
      p.motionAxis ?? moObj?.axis,
      CUSTOM_MOTION_AXES,
      'y'
    );

    const partOut: CustomModelPart = {
      id: cleanText(p.id, 64, `part_${i + 1}`),
      shape: rawShape as CustomModelShape,
      px: clampNum(p.px ?? posObj?.x, -50, 50, 0),
      py: clampNum(p.py ?? posObj?.y, -50, 50, 0),
      pz: clampNum(p.pz ?? posObj?.z, -50, 50, 0),
      rxDeg: clampNum(p.rxDeg ?? p.rx ?? rotObj?.x, -360, 360, 0),
      ryDeg: clampNum(p.ryDeg ?? p.ry ?? rotObj?.y, -360, 360, 0),
      rzDeg: clampNum(p.rzDeg ?? p.rz ?? rotObj?.z, -360, 360, 0),
      sx: clampNum(p.sx ?? scaleObj?.x, 0.01, 50, 1),
      sy: clampNum(p.sy ?? scaleObj?.y, 0.01, 50, 1),
      sz: clampNum(p.sz ?? scaleObj?.z, 0.01, 50, 1),
      color: normalizeHexColor(p.color, '#94a3b8'),
      roughness: clampNum(p.roughness ?? matObj?.roughness, 0, 1, 0.55),
      metalness: clampNum(p.metalness ?? matObj?.metalness, 0, 1, 0.1),
      ...(hasEmissive ? { emissive: emissiveHex } : {}),
      emissiveIntensity: clampNum(rawEmissiveIntensity, 0, 5, hasEmissive ? 1 : 0),
      opacity: clampNum(p.opacity ?? matObj?.opacity, 0, 1, 1),
      motionType,
      motionAxis,
      motionSpeed: clampNum(p.motionSpeed ?? moObj?.speed, -20, 20, 1.5),
      motionAmplitude: clampNum(
        p.motionAmplitude ?? moObj?.amplitude,
        0,
        20,
        motionType === 'none' ? 0 : 0.25
      ),
    };

    parts.push(partOut);
  }

  if (parts.length === 0) return undefined;

  let focusPartId: string | undefined;
  if (typeof s.focusPartId === 'string') {
    const candidate = s.focusPartId.trim().slice(0, 64);
    if (candidate && parts.some((part) => part.id === candidate)) {
      focusPartId = candidate;
    }
  }

  return {
    description: cleanText(s.description, 200, fallbackLabel),
    ...(focusPartId ? { focusPartId } : {}),
    parts,
  };
}

export function normalizeScenePlan(
  raw: unknown,
  options?: {
    width?: number;
    height?: number;
    fps?: number;
    fallbackContinuity?: VisualContinuityBible | null;
  }
): { ok: true; data: AnimationScenePlan } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Scene plan payload must be a structured JSON object.' };
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) {
    return { ok: false, error: 'Generated animation plan contained no scenes.' };
  }

  const rawVisualStyle =
    typeof obj.visualStyle === 'string' &&
    (VISUAL_STYLES as readonly string[]).includes(obj.visualStyle.trim().toLowerCase())
      ? (obj.visualStyle.trim().toLowerCase() as VisualStyle)
      : undefined;

  const rawRenderMode =
    obj.renderMode === '3d' || obj.renderMode === '2d' ? obj.renderMode : undefined;

  const styleImplies3D = Boolean(rawVisualStyle && STYLES_3D_PREFERRED.has(rawVisualStyle));

  const hasAny3DData =
    rawRenderMode === '3d' ||
    styleImplies3D ||
    obj.scenes.some((s) => {
      if (!s || typeof s !== 'object') return false;
      const seg = s as Record<string, unknown>;
      if (seg.scene3d) return true;
      if (
        typeof seg.visualStyle === 'string' &&
        STYLES_3D_PREFERRED.has(seg.visualStyle.trim().toLowerCase() as VisualStyle)
      ) {
        return true;
      }
      if (!Array.isArray(seg.elements)) return false;
      return seg.elements.some((e) => {
        if (!e || typeof e !== 'object') return false;
        const el = e as Record<string, unknown>;
        const k = String(el.kind || '').toLowerCase();
        return Boolean(
          el.pos3d ||
            el.rot3d ||
            el.size3d ||
            el.path3d ||
            el.buildingSpec3d ||
            el.productSpec3d ||
            el.customModelSpec ||
            el.shaderSpec ||
            el.assetRef ||
            k === 'building' ||
            k === 'product' ||
            k === 'custom' ||
            k === 'external-asset' ||
            k === 'shader-fx' ||
            k === 'procedural-mesh'
        );
      });
    });

  const resolvedRenderMode: '2d' | '3d' = rawRenderMode
    ? rawRenderMode
    : hasAny3DData
    ? '3d'
    : '2d';

  const preliminaryContinuity = normalizeVisualContinuity(
    obj.visualContinuity,
    options?.fallbackContinuity
  );

  const normalizedScenes: SceneSegment[] = [];
  for (let sIdx = 0; sIdx < Math.min(6, obj.scenes.length); sIdx++) {
    const rawSeg = obj.scenes[sIdx];
    if (!rawSeg || typeof rawSeg !== 'object') continue;
    const seg = rawSeg as Record<string, unknown>;

    const segVisualStyle =
      typeof seg.visualStyle === 'string' &&
      (VISUAL_STYLES as readonly string[]).includes(seg.visualStyle.trim().toLowerCase())
        ? (seg.visualStyle.trim().toLowerCase() as VisualStyle)
        : undefined;

    const rawElements = Array.isArray(seg.elements) ? seg.elements : [];
    const normalizedElements: SceneElement[] = [];
    for (let eIdx = 0; eIdx < Math.min(28, rawElements.length); eIdx++) {
      const rawEl = rawElements[eIdx];
      if (!rawEl || typeof rawEl !== 'object') continue;
      const el = rawEl as Record<string, unknown>;
      const m =
        el.motion && typeof el.motion === 'object'
          ? (el.motion as Record<string, unknown>)
          : {};
      const dirVal = Number(m.direction);

      const label = cleanText(el.label, 80, `Element ${eIdx + 1}`);
      const normalizedCustomSpec = normalizeCustomModelSpec(el.customModelSpec, label);
      const kind = resolveElementKind(el.kind, label, Boolean(normalizedCustomSpec));
      const variant = pickEnum(el.variant, ELEMENT_VARIANTS, 'idle');
      const colorPrimary = normalizeHexColor(el.colorPrimary, '#38bdf8');
      const colorSecondary = normalizeHexColor(el.colorSecondary, '#0f172a');
      const accentColor = normalizeHexColor(el.accentColor, '#e2e8f0');
      const x = clampNum(el.x, -0.3, 1.3, 0.5);
      const y = clampNum(el.y, -0.3, 1.3, 0.65);

      const baseEl: SceneElement = {
        id: cleanText(el.id, 64, `el_${sIdx + 1}_${eIdx + 1}`),
        kind,
        label,
        x,
        y,
        scale: clampNum(el.scale, 0.15, 3.5, 1),
        colorPrimary,
        colorSecondary,
        accentColor,
        variant,
        count: Math.round(clampNum(el.count, 1, 16, 1)),
        depth: clampNum(el.depth, 0, 1, 0.5),
        motion: {
          type: pickEnum(m.type, MOTION_TYPES, 'static'),
          speed: clampNum(m.speed, -4, 4, 1),
          amplitude: clampNum(m.amplitude, 0, 0.5, 0.1),
          direction: dirVal < 0 ? -1 : 1,
        },
      };

      if (el.opacity !== undefined) {
        baseEl.opacity = clampNum(el.opacity, 0.05, 1, 1);
      }
      if (el.rotationDeg !== undefined) {
        baseEl.rotationDeg = clampNum(el.rotationDeg, -360, 360, 0);
      }

      if (kind === 'chart') {
        const chartSpec = normalizeChartSpec(el.chartSpec, el, label);
        if (chartSpec) baseEl.chartSpec = chartSpec;
      } else if (kind === 'character' || kind === 'creature') {
        const matchBible = preliminaryContinuity.characterBible.find(
          (b) =>
            label.toLowerCase().includes(b.name.toLowerCase()) ||
            b.name.toLowerCase().includes(label.toLowerCase())
        );
        baseEl.characterSpec = hydrateCharacterSpec(
          el.characterSpec,
          baseEl,
          matchBible || null
        );
      } else if (kind === 'vehicle') {
        baseEl.vehicleSpec = normalizeVehicleSpec(el.vehicleSpec, el.kind, label);
      } else if (kind === 'drone') {
        baseEl.droneSpec = normalizeDroneSpec(el.droneSpec, baseEl);
      } else if (kind === 'planet') {
        baseEl.planetSpec = normalizePlanetSpec(el.planetSpec, label, baseEl);
      } else if (kind === 'text') {
        baseEl.textSpec = normalizeTextSpec(el.textSpec, label);
      } else if (kind === 'logo') {
        baseEl.logoSpec = normalizeLogoSpec(el.logoSpec, label);
      } else if (kind === 'road') {
        baseEl.roadSpec = normalizeRoadSpec(el.roadSpec, variant);
      } else if (kind === 'building') {
        baseEl.buildingSpec3d = normalizeBuildingSpec3D(
          el.buildingSpec3d,
          label,
          variant,
          accentColor
        );
      } else if (kind === 'product') {
        baseEl.productSpec3d = normalizeProductSpec3D(el.productSpec3d, label);
      } else if (kind === 'custom' && normalizedCustomSpec) {
        baseEl.customModelSpec = normalizedCustomSpec;
      }

      const normPhysics = normalizePhysicsSpec(el.physicsSpec);
      if (normPhysics) baseEl.physicsSpec = normPhysics;

      const normShader = normalizeShaderSpec(el.shaderSpec, baseEl);
      if (normShader) {
        baseEl.shaderSpec = normShader;
      } else if (kind === 'shader-fx') {
        const lbl = label.toLowerCase();
        baseEl.shaderSpec = {
          preset: /\bwater|ocean|sea|wave\b/.test(lbl)
            ? 'water-waves'
            : /\bhologram|fresnel\b/.test(lbl)
            ? 'fresnel-hologram'
            : /\bgrid\b/.test(lbl)
            ? 'neon-grid'
            : 'energy-plasma',
          primaryColor: baseEl.colorPrimary,
          secondaryColor: baseEl.accentColor,
          speed: 1.2,
          intensity: 1.5,
        };
      }

      if (el.proceduralGeometry !== undefined || kind === 'procedural-mesh') {
        baseEl.proceduralGeometry = pickEnum(
          el.proceduralGeometry,
          PROCEDURAL_GEOMETRIES,
          /\btorus\b/.test(label.toLowerCase())
            ? 'torus'
            : /\bwave|plane|ocean\b/.test(label.toLowerCase())
            ? 'wave-plane'
            : /\bknot\b/.test(label.toLowerCase())
            ? 'torus-knot'
            : /\bcone|pyramid\b/.test(label.toLowerCase())
            ? 'cone'
            : /\bcube|box\b/.test(label.toLowerCase())
            ? 'box'
            : /\bicosahedron|crystal\b/.test(label.toLowerCase())
            ? 'icosahedron'
            : 'sphere'
        );
      }

      const normAsset = normalizeAssetRef(el.assetRef);
      if (normAsset) baseEl.assetRef = normAsset;

      if (el.pos3d && typeof el.pos3d === 'object') {
        baseEl.pos3d = normalizeVector3(
          el.pos3d,
          defaultPos3DFromElement(baseEl)
        );
      } else if (resolvedRenderMode === '3d') {
        baseEl.pos3d = defaultPos3DFromElement(baseEl);
      }

      if (el.rot3d && typeof el.rot3d === 'object') {
        baseEl.rot3d = normalizeVector3(
          el.rot3d,
          { x: 0, y: 0, z: 0 },
          { min: -360, max: 360 }
        );
      }

      if (el.size3d && typeof el.size3d === 'object') {
        const s3 = el.size3d as Record<string, unknown>;
        baseEl.size3d = {
          w: clampNum(s3.w, 0.1, 200, 2),
          h: clampNum(s3.h, 0.1, 250, 2),
          d: clampNum(s3.d, 0.1, 200, 2),
        };
      }

      if (Array.isArray(el.path3d) && el.path3d.length > 0) {
        const rawPath3d = el.path3d;
        const normalizedPath: Keyframe3DSpec[] = rawPath3d
          .slice(0, 16)
          .map((kf, kIdx) => {
            if (!kf || typeof kf !== 'object') return null;
            const k = kf as Record<string, unknown>;
            const fallbackPos = baseEl.pos3d || { x: 0, y: 0, z: 0 };
            const entry: Keyframe3DSpec = {
              t: clampNum(
                k.t,
                0,
                1,
                rawPath3d.length > 1 ? kIdx / (rawPath3d.length - 1) : 0
              ),
              x: clampNum(k.x, -500, 500, fallbackPos.x),
              y: clampNum(k.y, -500, 500, fallbackPos.y),
              z: clampNum(k.z, -500, 500, fallbackPos.z),
            };
            if (k.rotY !== undefined) {
              entry.rotY = clampNum(k.rotY, -720, 720, 0);
            }
            return entry;
          })
          .filter((item): item is Keyframe3DSpec => item !== null)
          .sort((a, b) => a.t - b.t);
        if (normalizedPath.length > 0) {
          baseEl.path3d = normalizedPath;
        }
      }

      normalizedElements.push(baseEl);
    }

    if (normalizedElements.length === 0) {
      continue;
    }

    const bg =
      seg.background && typeof seg.background === 'object'
        ? (seg.background as Record<string, unknown>)
        : {};
    const cam =
      seg.camera && typeof seg.camera === 'object'
        ? (seg.camera as Record<string, unknown>)
        : {};
    const light =
      seg.lighting && typeof seg.lighting === 'object'
        ? (seg.lighting as Record<string, unknown>)
        : {};
    const weather =
      seg.weather && typeof seg.weather === 'object'
        ? (seg.weather as Record<string, unknown>)
        : {};

    const normalizedBackground: SceneSegment['background'] = {
      mode: pickEnum(bg.mode, BG_MODES, 'scene'),
      solidColor: normalizeHexColor(bg.solidColor, '#050814'),
      skyTop: normalizeHexColor(bg.skyTop, '#020617'),
      skyBottom: normalizeHexColor(bg.skyBottom, '#0f172a'),
      horizonColor: normalizeHexColor(bg.horizonColor, '#1e293b'),
      groundColor: normalizeHexColor(bg.groundColor, '#090d16'),
      groundElevation: clampNum(bg.groundElevation, 0.4, 0.98, 0.72),
    };
    const normalizedCamera: SceneSegment['camera'] = {
      motion: pickEnum(cam.motion, CAMERA_MOTIONS, 'static'),
      intensity: clampNum(cam.intensity, 0, 1, 0.35),
    };
    const normalizedLighting: SceneSegment['lighting'] = {
      mood: pickEnum(light.mood, LIGHTING_MOODS, 'cinematic'),
      ambientAlpha: clampNum(light.ambientAlpha, 0, 0.75, 0.2),
      bloomColor: normalizeHexColor(light.bloomColor, '#38bdf8'),
      volumetricRays:
        typeof light.volumetricRays === 'number' && Number.isFinite(light.volumetricRays)
          ? clampNum(light.volumetricRays, 0, 1, 0)
          : Boolean(light.volumetricRays),
      vignette: clampNum(light.vignette, 0, 1, 0.35),
    };
    const normalizedWeather: SceneSegment['weather'] = {
      type: pickEnum(weather.type, WEATHER_TYPES, 'none'),
      density: clampNum(weather.density, 0, 1, 0),
      windX: clampNum(weather.windX, -1, 1, 0),
    };

    const segmentOut: SceneSegment = {
      id: cleanText(seg.id, 64, `scene_${sIdx + 1}`),
      title: cleanText(seg.title, 100, `Scene ${sIdx + 1}`),
      durationSec: clampNum(seg.durationSec, 2, 20, 5),
      transition: pickEnum(seg.transition, TRANSITION_MODES, 'fade'),
      ...(segVisualStyle ? { visualStyle: segVisualStyle } : {}),
      background: normalizedBackground,
      camera: normalizedCamera,
      lighting: normalizedLighting,
      weather: normalizedWeather,
      elements: normalizedElements,
    };

    if (
      resolvedRenderMode === '3d' ||
      seg.scene3d ||
      (segVisualStyle && STYLES_3D_PREFERRED.has(segVisualStyle))
    ) {
      segmentOut.scene3d = normalizeScene3DConfig(seg.scene3d, {
        background: normalizedBackground,
        camera: normalizedCamera,
        lighting: normalizedLighting,
        weather: normalizedWeather,
        elements: normalizedElements,
      });
    }

    normalizedScenes.push(segmentOut);
  }

  if (normalizedScenes.length === 0) {
    return {
      ok: false,
      error: 'Generated animation scenes contained no renderable elements.',
    };
  }

  const summedDuration = normalizedScenes.reduce((acc, s) => acc + s.durationSec, 0);
  const candidate: AnimationScenePlan = {
    planVersion: 1,
    ...(resolvedRenderMode ? { renderMode: resolvedRenderMode } : {}),
    ...(rawVisualStyle ? { visualStyle: rawVisualStyle } : {}),
    title: cleanText(obj.title, 120, normalizedScenes[0].title || 'Untitled Scene'),
    summary: cleanText(
      obj.summary,
      500,
      `Multi-layer ${normalizedScenes.length}-scene animation plan.`
    ),
    width: Math.round(clampNum(options?.width ?? obj.width, 128, 4096, 1280)),
    height: Math.round(clampNum(options?.height ?? obj.height, 128, 4096, 720)),
    fps: Math.round(clampNum(options?.fps ?? obj.fps, 12, 120, 30)),
    totalDurationSec: clampNum(summedDuration, 2, 60, 5),
    scenes: normalizedScenes,
    visualContinuity: preliminaryContinuity,
  };

  return validateScenePlan(candidate);
}

function getScenePlanQualityIssue(plan: AnimationScenePlan): string | null {
  const sceneIds = new Set<string>();

  for (const [sceneIndex, scene] of plan.scenes.entries()) {
    if (sceneIds.has(scene.id)) {
      return `Scene ${sceneIndex + 1} has a duplicate scene id ("${scene.id}").`;
    }
    sceneIds.add(scene.id);

    const elementIds = new Set<string>();
    for (const [elementIndex, element] of scene.elements.entries()) {
      if (elementIds.has(element.id)) {
        return `Scene ${sceneIndex + 1} has a duplicate element id ("${element.id}") at element ${elementIndex + 1}.`;
      }
      elementIds.add(element.id);
    }

    if (plan.renderMode === '3d' && !scene.scene3d) {
      return `Scene ${sceneIndex + 1} is missing its 3D scene configuration while renderMode is 3d.`;
    }
    if (plan.renderMode === '2d' && scene.scene3d) {
      return `Scene ${sceneIndex + 1} contains 3D configuration while renderMode is 2d.`;
    }

    if (plan.renderMode === '2d') {
      for (const [elementIndex, element] of scene.elements.entries()) {
        if (element.pos3d || element.rot3d || element.size3d || element.path3d || element.buildingSpec3d || element.productSpec3d) {
          return `Scene ${sceneIndex + 1}, element ${elementIndex + 1} ("${element.id}") contains 3D-only spatial data while renderMode is 2d.`;
        }
      }
    }
  }

  const sceneDuration = plan.scenes.reduce((total, scene) => total + scene.durationSec, 0);
  if (Math.abs(sceneDuration - plan.totalDurationSec) > 0.05) {
    return `Scene durations total ${sceneDuration.toFixed(2)}s, but totalDurationSec is ${plan.totalDurationSec.toFixed(2)}s.`;
  }

  return null;
}

export function validateScenePlan(raw: unknown): {
  ok: true;
  data: AnimationScenePlan;
} | {
  ok: false;
  error: string;
} {
  const parsed = AnimationScenePlanSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Scene validation failed at ${issue?.path?.join('.') || 'root'}: ${issue?.message || 'Invalid schema'}`,
    };
  }

  const qualityIssue = getScenePlanQualityIssue(parsed.data);
  if (qualityIssue) {
    return { ok: false, error: `Scene quality validation failed: ${qualityIssue}` };
  }

  return { ok: true, data: parsed.data };
}
