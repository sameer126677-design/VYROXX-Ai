import type { CharacterPose, CharacterRig } from './rig';
import type { LocomotionState } from './locomotion';
import { applyLocomotionPose } from './locomotion';
import type { CharacterLocomotionBlend } from './characterLocomotionBlend';
import { blendCharacterLocomotion } from './characterLocomotionBlend';
export interface CharacterLocomotionPoseResult { pose:CharacterPose; blend:CharacterLocomotionBlend; }
export function applyCharacterLocomotionIntelligence(rig:CharacterRig,basePose:CharacterPose,state:LocomotionState):CharacterLocomotionPoseResult {
 if(basePose.rigId!==rig.id) throw new Error('Locomotion pose rig does not match.');
 const blend=blendCharacterLocomotion(state);
 const pose=applyLocomotionPose(rig,basePose,state);
 const directional=blend.backward*0.12+blend.strafeLeft*-0.08+blend.strafeRight*0.08;
 const joints=pose.joints.map(j=>j.jointId==='spine'?{...j,rotation:{...j.rotation,y:j.rotation.y+directional}}:j);
 return {pose:{...pose,joints},blend};
}
