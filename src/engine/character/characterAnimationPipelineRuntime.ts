import type { CharacterAnimationPipelineInput, CharacterAnimationPipelineResult } from './characterAnimationPipeline';
import { evaluateCharacterAnimationPipeline } from './characterAnimationPipeline';
export function updateCharacterAnimationPipeline(input:CharacterAnimationPipelineInput):CharacterAnimationPipelineResult {
 return evaluateCharacterAnimationPipeline(input);
}
