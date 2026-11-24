import type { CombatMovementState, CombatMovementSample } from './combatMovement';
import { sampleCombatMovement } from './combatMovement';
import type { CombatAnimationState } from './combatAnimationState';
import type { CombatAnimationRequest } from './combatAnimation';
import type { CombatFootworkSample } from './combatFootwork';
import { sampleCombatFootwork } from './combatFootwork';
export interface CombatMotionSyncResult { movement:CombatMovementSample|null; animation:CombatAnimationRequest|null; footwork:CombatFootworkSample|null; normalizedProgress:number; complete:boolean; }
export function sampleSynchronizedCombatMotion(movement:CombatMovementState|null,animation:CombatAnimationState,frame:number):CombatMotionSyncResult{
 if(!Number.isFinite(frame)||frame<animation.startedAtFrame)throw new Error('Invalid synchronized combat motion frame.');
 const movementSample=movement?sampleCombatMovement(movement,frame):null;
 const animationProfile=animation.profile;
 const duration=movement?movement.endsAtFrame-movement.startedAtFrame:animationProfile?.durationFrames??0;
 const start=movement?.startedAtFrame??animation.startedAtFrame;
 const progress=duration>0?Math.max(0,Math.min(1,(frame-start)/duration)):1;
 const request=animationProfile?{action:animationProfile.action,startFrame:animation.startedAtFrame,durationFrames:animationProfile.durationFrames,intensity:animationProfile.intensity,side:animationProfile.side}:null;
 const footwork=movement?sampleCombatFootwork(movement.action,frame-movement.startedAtFrame,Math.max(1,movement.endsAtFrame-movement.startedAtFrame)):null;
 return {movement:movementSample,animation:request,footwork,normalizedProgress:progress,complete:(movementSample?.complete??true)&&(!animationProfile||frame>=animation.endsAtFrame)};
}
