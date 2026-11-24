import type { CharacterUnifiedControllerResult } from './characterUnifiedController';
export interface CharacterUnifiedControllerTelemetry { speed:number; grounded:boolean; contactCount:number; footIKConverged:boolean|null; balanceStable:boolean|null; balanceCorrectionMagnitude:number; }
export function summarizeCharacterUnifiedController(result:CharacterUnifiedControllerResult):CharacterUnifiedControllerTelemetry {
 const velocity=result.controller.state.physics.velocity;
 return {speed:Math.hypot(velocity.x,velocity.z),grounded:result.controller.grounded,contactCount:result.controller.contacts.length,footIKConverged:result.groundedIK?.ik.converged??null,balanceStable:result.balance?.stable??null,balanceCorrectionMagnitude:result.balance?Math.hypot(result.balance.correction.x,result.balance.correction.z):0};
}
