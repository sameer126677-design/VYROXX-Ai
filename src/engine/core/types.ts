import type { AnimationScenePlan, SceneElement, SceneSegment } from '../../shared/sceneSchema';

export const VYROXX_DOCUMENT_VERSION = 1 as const;
export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
export type Transform3D = { position: Vec3; rotation: Vec3; scale: Vec3 };
export type EngineNodeKind = SceneElement['kind'] | 'group' | 'camera' | 'light' | 'audio';
export type EngineAssetSource = 'user' | 'generated' | 'provider' | 'builtin';

export interface EngineAssetRef {
  id: string;
  source: EngineAssetSource;
  mimeType?: string;
  uri?: string;
  storagePath?: string;
  providerId?: string;
  metadata?: Record<string, string | number | boolean>;
}
export interface EngineNode {
  id: string;
  kind: EngineNodeKind;
  name: string;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  transform: Transform3D;
  opacity: number;
  zIndex: number;
  sourceElement?: SceneElement;
  assetRefs: EngineAssetRef[];
  tags: string[];
}
export interface EngineCameraTrack {
  motion: SceneSegment['camera']['motion'];
  intensity: number;
  startPosition?: Vec3;
  endPosition?: Vec3;
}
export interface EngineScene {
  id: string;
  name: string;
  durationSec: number;
  startFrame: number;
  endFrame: number;
  transition: SceneSegment['transition'];
  visualStyle: string;
  background: SceneSegment['background'];
  lighting: SceneSegment['lighting'];
  weather: SceneSegment['weather'];
  camera: EngineCameraTrack;
  nodes: EngineNode[];
  sourceSegment: SceneSegment;
}
export interface EngineTimeline {
  fps: number;
  totalFrames: number;
  durationSec: number;
  width: number;
  height: number;
}
export interface EngineRequirement {
  id: string;
  description: string;
  category: 'visual' | 'motion' | 'continuity' | 'technical' | 'audio';
  importance: 'must' | 'should' | 'optional';
  satisfied: boolean | 'unknown';
  evidence?: string;
}
export interface EngineQualityIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  sceneId?: string;
  nodeId?: string;
  repairHint?: string;
}
export interface EngineQualityReport {
  status: 'not-run' | 'passed' | 'needs-review' | 'failed';
  score: number | null;
  issues: EngineQualityIssue[];
  checkedAt?: string;
}
export interface CreationDocument {
  documentVersion: typeof VYROXX_DOCUMENT_VERSION;
  id: string;
  title: string;
  prompt: string;
  summary: string;
  timeline: EngineTimeline;
  renderMode: '2d' | '3d';
  visualStyle: string;
  scenes: EngineScene[];
  requirements: EngineRequirement[];
  assets: EngineAssetRef[];
  continuity: AnimationScenePlan['visualContinuity'];
  quality: EngineQualityReport;
  metadata: {
    createdAt: string;
    source: 'scene-plan' | 'native';
    planner: 'existing-ai-model' | 'user' | 'system';
    imageProviderRequested: boolean;
  };
}
export interface EngineStageContext {
  document: CreationDocument;
  signal?: AbortSignal;
  onProgress?: (stage: string, progress: number, message: string) => void;
}
export type EngineStageName = 'normalize' | 'resolve-assets' | 'build-visuals' | 'animate' | 'direct-camera' | 'quality-check' | 'compose' | 'render';
export interface EngineStageResult<T = unknown> {
  stage: EngineStageName;
  status: 'completed' | 'skipped' | 'needs-provider' | 'failed';
  output?: T;
  messages: string[];
}
