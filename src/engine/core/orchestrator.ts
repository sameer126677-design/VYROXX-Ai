import type { CreationDocument, EngineStageName, EngineStageResult } from './types';
import { reflowTimeline } from './document';

export interface EngineAdapters {
  resolveAssets?: (document: CreationDocument, signal?: AbortSignal) => Promise<CreationDocument>;
  buildVisuals?: (document: CreationDocument, signal?: AbortSignal) => Promise<CreationDocument>;
  animate?: (document: CreationDocument, signal?: AbortSignal) => Promise<CreationDocument>;
  directCamera?: (document: CreationDocument, signal?: AbortSignal) => Promise<CreationDocument>;
  qualityCheck?: (document: CreationDocument, signal?: AbortSignal) => Promise<CreationDocument>;
  compose?: (document: CreationDocument, signal?: AbortSignal) => Promise<CreationDocument>;
  render?: (document: CreationDocument, signal?: AbortSignal) => Promise<unknown>;
}
export interface EngineRunResult {
  document: CreationDocument;
  stages: EngineStageResult[];
  renderOutput?: unknown;
}
const STAGE_ORDER: EngineStageName[] = ['normalize', 'resolve-assets', 'build-visuals', 'animate', 'direct-camera', 'quality-check', 'compose', 'render'];

/**
 * Coordinates VYROXX-owned deterministic stages. Existing AI models remain upstream
 * planners; image providers are only called by an explicit asset-resolution adapter.
 */
export async function runCreationPipeline(
  input: CreationDocument,
  adapters: EngineAdapters = {},
  options: { signal?: AbortSignal; onProgress?: (stage: EngineStageName, progress: number) => void } = {}
): Promise<EngineRunResult> {
  let document = reflowTimeline(input);
  const stages: EngineStageResult[] = [];
  const steps: Array<{ name: EngineStageName; run?: (doc: CreationDocument, signal?: AbortSignal) => Promise<CreationDocument> }> = [
    { name: 'normalize' },
    { name: 'resolve-assets', run: adapters.resolveAssets },
    { name: 'build-visuals', run: adapters.buildVisuals },
    { name: 'animate', run: adapters.animate },
    { name: 'direct-camera', run: adapters.directCamera },
    { name: 'quality-check', run: adapters.qualityCheck },
    { name: 'compose', run: adapters.compose },
  ];
  for (let index = 0; index < steps.length; index += 1) {
    if (options.signal?.aborted) throw new DOMException('Creation cancelled', 'AbortError');
    const step = steps[index];
    options.onProgress?.(step.name, Math.round(((index + 1) / (STAGE_ORDER.length)) * 100));
    if (!step.run) {
      stages.push({ stage: step.name, status: step.name === 'normalize' ? 'completed' : 'skipped', messages: [step.name === 'normalize' ? 'Timeline normalized.' : 'Adapter not connected yet; no provider call was made.'] });
      continue;
    }
    try {
      document = await step.run(document, options.signal);
      stages.push({ stage: step.name, status: 'completed', messages: ['Stage completed.'] });
    } catch (error) {
      stages.push({ stage: step.name, status: 'failed', messages: [error instanceof Error ? error.message : 'Unknown engine stage error.'] });
      return { document, stages };
    }
  }
  let renderOutput: unknown;
  if (adapters.render) {
    try {
      renderOutput = await adapters.render(document, options.signal);
      stages.push({ stage: 'render', status: 'completed', messages: ['Render adapter completed.'] });
    } catch (error) {
      stages.push({ stage: 'render', status: 'failed', messages: [error instanceof Error ? error.message : 'Render failed.'] });
    }
  } else {
    stages.push({ stage: 'render', status: 'skipped', messages: ['Existing renderer integration is the next connection point.'] });
  }
  return { document, stages, renderOutput };
}
