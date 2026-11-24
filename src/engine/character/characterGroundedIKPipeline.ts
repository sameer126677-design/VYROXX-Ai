import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import type { GroundContactOptions, FootPlantState, GroundContactSurface } from './groundContact';
import { updateFootPlantTracker } from './groundContact';
import { solveFullBodyIK3D } from './fullBodyIK';
import { adaptCharacterFootTargets, type CharacterFootAdaptationOptions } from './characterFootTargetAdaptation';
import { calculateCharacterPelvisAdaptation, type CharacterPelvisAdaptation } from './characterPelvisAdaptation';
export interface CharacterGroundedIKInput { rig:CharacterRig; pose:CharacterPose; frame:number; fps:number; state:FootPlantState; surface:GroundContactSurface; rootPosition:Vec3; contact:Omit<GroundContactOptions,'surface'|'rootPosition'>; adaptation?:CharacterFootAdaptationOptions; iterations?:number; tolerance?:number; pelvisResponse?:number; maxPelvisOffset?:number; }
export interface CharacterGroundedIKResult { pose:CharacterPose; state:FootPlantState; pelvis:CharacterPelvisAdaptation; adapted:boolean; rejectedSides:('left'|'right')[]; ik:{converged:boolean;iterations:number;maxTargetError:number}; }
export function stepCharacterGroundedIK(input:CharacterGroundedIKInput):CharacterGroundedIKResult {
 const {rig,pose,frame,fps,state}=input;
 if(pose.rigId!==rig.id||state.rigId!==rig.id||!Number.isFinite(frame)||!Number.isFinite(fps)||fps<=0) throw new Error('Grounded IK rig, frame or state is invalid.');
 const tracked=updateFootPlantTracker(rig,frame,fps,state,{...input.contact,surface:input.surface,rootPosition:input.rootPosition});
 const adapted=adaptCharacterFootTargets(tracked.plan,input.surface,input.rootPosition.y,input.adaptation);
 const requests=tracked.plan.ikRequests.filter(request=>adapted.contacts.some(contact=>contact.side+'_hip'===request.rootJointId&&contact.reachable)).map(request=>({...request,target:{...adapted.contacts.find(contact=>contact.side+'_hip'===request.rootJointId)!.target}}));
 const solved=solveFullBodyIK3D(rig,pose,{requests,iterations:input.iterations,tolerance:input.tolerance});
 const pelvis=calculateCharacterPelvisAdaptation(adapted,input.rootPosition,input.maxPelvisOffset??0.22,input.pelvisResponse??1);
 const maxTargetError=solved.constraints.reduce((max,item)=>Math.max(max,item.targetError),0);
 return {pose:solved.pose,state:tracked.state,pelvis,adapted:adapted.valid,rejectedSides:adapted.rejectedSides,ik:{converged:solved.converged,iterations:solved.iterations,maxTargetError}};
}
