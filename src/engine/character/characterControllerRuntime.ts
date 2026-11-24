import type { CharacterControllerPipelineInput, CharacterControllerPipelineResult } from './characterControllerPipeline';
import { stepCharacterControllerPipeline } from './characterControllerPipeline';
export function updateCharacterController(input:CharacterControllerPipelineInput):CharacterControllerPipelineResult {
 return stepCharacterControllerPipeline(input);
}
