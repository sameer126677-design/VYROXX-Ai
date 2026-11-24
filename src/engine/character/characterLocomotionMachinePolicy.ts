import type { CharacterLocomotionMode } from './characterLocomotionMachineState';
export interface CharacterLocomotionSignals { speed:number; verticalVelocity:number; grounded:boolean; turning:boolean; walkSpeed?:number; runSpeed?:number; sprintSpeed?:number; }
export function chooseCharacterLocomotionMode(s:CharacterLocomotionSignals,wasGrounded:boolean,stableGroundFrames:number):CharacterLocomotionMode {
 const walk=s.walkSpeed??1.35,run=s.runSpeed??3.4,sprint=s.sprintSpeed??5.8;
 if(![s.speed,s.verticalVelocity,walk,run,sprint].every(Number.isFinite)||s.speed<0||walk<=0||run<=walk||sprint<=run) throw new Error('Locomotion mode thresholds or signals are invalid.');
 if(!s.grounded) return s.verticalVelocity>0.18?'jump':'fall';
 if(!wasGrounded&&s.grounded) return 'land';
 if(s.speed<0.12) return s.turning?'turn':stableGroundFrames>1?'idle':'stop';
 if(s.turning&&s.speed<0.45) return 'turn';
 return s.speed<walk?'walk':s.speed<run?'run':'sprint';
}
export function characterLocomotionTransitionFrames(from:CharacterLocomotionMode,to:CharacterLocomotionMode,fps:number):number {
 if(!Number.isFinite(fps)||fps<=0) throw new Error('Locomotion transition fps must be positive.');
 if(to==='jump'||to==='fall'||to==='land') return Math.max(1,Math.round(fps*0.08));
 if(from==='idle'||to==='idle'||to==='stop') return Math.max(1,Math.round(fps*0.18));
 if(to==='sprint'||from==='sprint') return Math.max(1,Math.round(fps*0.22));
 return Math.max(1,Math.round(fps*0.14));
}
