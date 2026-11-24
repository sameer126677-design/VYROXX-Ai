import type { CharacterRig, CharacterPose } from './rig';
import type { CharacterExpression, ProceduralCharacterModel } from './proceduralCharacter';
import { updateCharacterExpression, setCharacterBlink, setCharacterGaze, setCharacterViseme } from './proceduralCharacter';
import { createMotionClip, sampleMotionClip, type MotionPreset, type MotionClip } from './animation';
import { createThreeRigRuntime, updateThreeRigFromPose, type ThreeRigOptions, type ThreeRigRuntime } from './threeRig';
import { sampleLipSync, type LipSyncTrack } from './lipSync';
import { evaluateCharacterActionSequence, type CharacterActionSequence, type CharacterActionFrame } from './actionSequence';
import { setCharacterHandGesture } from './proceduralCharacter';
import { applyFootIKToPose, evaluateFootContactPlan, type FootIKOptions } from './footIK';
import { solveLimbIK3D, type LimbIK3DRequest } from './ik3d';
import { solveFullBodyIK3D, type FullBodyIKOptions } from './fullBodyIK';
import { solveCharacterBalance3D, solveDynamicCharacterBalance3D, type BalanceOptions, type DynamicBalanceOptions } from './balance';
import { evaluateGroundContactPlan, applyGroundContactPlan, createFootPlantState, updateFootPlantTracker, type FootPlantState, type GroundContactPlan, type GroundContactOptions } from './groundContact';
import { evaluateLocomotionState, applyLocomotionPose, type LocomotionInput, type LocomotionOptions } from './locomotion';

export interface ThreeCharacterFrame { runtime: ThreeRigRuntime; pose: CharacterPose; frame: number; }
export interface ThreeCharacterIKOptions { ik3D?: LimbIK3DRequest[]; fullBodyIK?: FullBodyIKOptions; balance?: BalanceOptions; dynamicBalance?: DynamicBalanceOptions; groundContact?: GroundContactOptions; locomotion?: LocomotionInput & { options?: LocomotionOptions }; }

function applyRequestedIK(rig: CharacterRig, pose: CharacterPose, requests?: LimbIK3DRequest[], fullBodyIK?: FullBodyIKOptions, balance?: BalanceOptions, groundContact?: GroundContactOptions, frame = 0, fps = 30, dynamicBalance?: DynamicBalanceOptions): CharacterPose {
  const grounded = groundContact ? applyGroundContactPlan(rig, pose, evaluateGroundContactPlan(rig, frame, fps, groundContact)) : pose;
  const withIndividual = (requests ?? []).reduce((current, request) => solveLimbIK3D(rig, current, request).pose, grounded);
  const coordinated = fullBodyIK ? solveFullBodyIK3D(rig, withIndividual, fullBodyIK).pose : withIndividual;
  const balanced = dynamicBalance ? solveDynamicCharacterBalance3D(rig, coordinated, dynamicBalance).pose : coordinated;
  return balance ? solveCharacterBalance3D(rig, balanced, balance).pose : balanced;
}

/** Builds a rig runtime and evaluates one deterministic animation frame. */
export function evaluateThreeCharacterFrame(
  rig: CharacterRig, preset: MotionPreset, frame: number, fps: number,
  options: ThreeRigOptions & { durationSec?: number; clip?: MotionClip; footIK?: FootIKOptions; ik3D?: LimbIK3DRequest[]; fullBodyIK?: FullBodyIKOptions; balance?: BalanceOptions; dynamicBalance?: DynamicBalanceOptions; groundContact?: GroundContactOptions; locomotion?: LocomotionInput & { options?: LocomotionOptions } } = {}
): ThreeCharacterFrame {
  const runtime = createThreeRigRuntime(rig, options);
  const locomotion = options.locomotion ? evaluateLocomotionState({ ...options.locomotion, frame, fps }, options.locomotion.options) : undefined;
  const activePreset = locomotion?.preset ?? preset;
  const clip = options.clip ?? createMotionClip(rig, activePreset, fps, options.durationSec ?? 2);
  let pose = sampleMotionClip(rig, clip, frame, fps);
  if (locomotion) pose = applyLocomotionPose(rig, pose, locomotion);
  if (options.footIK && ['walk', 'run', 'sprint'].includes(preset)) pose = applyFootIKToPose(rig, pose, evaluateFootContactPlan(rig, frame, fps, options.footIK), options.footIK);
  const contactOptions = locomotion ? { ...options.groundContact, rootVelocity: options.locomotion!.velocity, strideLength: locomotion.strideLength, stepHeight: locomotion.stepHeight, cycleRate: locomotion.cycleRate } : options.groundContact;
  pose = applyRequestedIK(rig, pose, options.ik3D, options.fullBodyIK, options.balance, contactOptions, frame, fps, options.dynamicBalance);
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return { runtime, pose, frame };
}


export interface StatefulThreeCharacterFrameResult {
  pose: CharacterPose;
  footPlantState: FootPlantState;
  groundContactPlan: GroundContactPlan;
  frame: number;
}
export interface StatefulThreeCharacterFrameOptions {
  durationSec?: number;
  clip?: MotionClip;
  unitScale?: number;
  groundContact?: GroundContactOptions;
  locomotion?: LocomotionInput & { options?: LocomotionOptions };
  ik3D?: LimbIK3DRequest[];
  fullBodyIK?: FullBodyIKOptions;
  dynamicBalance?: Omit<DynamicBalanceOptions, 'supportPoints'>;
  balance?: Omit<BalanceOptions, 'supportPoints'>;
}
/**
 * Sequential character update with caller-owned persistent foot anchors.
 * Retain the returned footPlantState and pass it to the next frame. For
 * timeline seeking, create a fresh state and replay from the desired start.
 */
export function updateThreeCharacterFrameWithContactState(
  runtime: ThreeRigRuntime,
  rig: CharacterRig,
  preset: MotionPreset,
  frame: number,
  fps: number,
  previousState: FootPlantState = createFootPlantState(rig.id),
  options: StatefulThreeCharacterFrameOptions = {}
): StatefulThreeCharacterFrameResult {
  const locomotion = options.locomotion
    ? evaluateLocomotionState({ ...options.locomotion, frame, fps }, options.locomotion.options)
    : undefined;
  const activePreset = locomotion?.preset ?? preset;
  const clip = options.clip ?? createMotionClip(rig, activePreset, fps, options.durationSec ?? 2);
  let pose = sampleMotionClip(rig, clip, frame, fps, locomotion?.phase);
  if (locomotion) pose = applyLocomotionPose(rig, pose, locomotion);
  const contactOptions: GroundContactOptions = {
    ...options.groundContact,
    ...(locomotion ? {
      rootVelocity: options.locomotion?.velocity ?? { x: 0, z: 0 },
      strideLength: locomotion.strideLength,
      stepHeight: locomotion.stepHeight,
      cycleRate: locomotion.cycleRate
    } : {})
  };
  const tracked = updateFootPlantTracker(rig, frame, fps, previousState, contactOptions);
  pose = applyGroundContactPlan(rig, pose, tracked.plan);
  if (options.ik3D?.length) {
    pose = options.ik3D.reduce((current, request) => solveLimbIK3D(rig, current, request).pose, pose);
  }
  if (options.fullBodyIK) pose = solveFullBodyIK3D(rig, pose, options.fullBodyIK).pose;
  const supportPoints = tracked.plan.supportPoints;
  if (supportPoints.length) {
    if (options.dynamicBalance) {
      pose = solveDynamicCharacterBalance3D(rig, pose, {
        ...options.dynamicBalance,
        supportPoints,
        velocity: options.dynamicBalance.velocity ?? options.locomotion?.velocity
      }).pose;
    } else if (options.balance) {
      pose = solveCharacterBalance3D(rig, pose, { ...options.balance, supportPoints }).pose;
    }
  }
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return { pose, footPlantState: tracked.state, groundContactPlan: tracked.plan, frame };
}

/** Updates an existing runtime without rebuilding its Three.js hierarchy. */
export function updateThreeCharacterFrame(
  runtime: ThreeRigRuntime, rig: CharacterRig, preset: MotionPreset, frame: number, fps: number,
  options: { durationSec?: number; clip?: MotionClip; unitScale?: number; footIK?: FootIKOptions; ik3D?: LimbIK3DRequest[]; fullBodyIK?: FullBodyIKOptions; balance?: BalanceOptions; groundContact?: GroundContactOptions; locomotion?: LocomotionInput & { options?: LocomotionOptions } } = {}
): CharacterPose {
  const locomotion = options.locomotion ? evaluateLocomotionState({ ...options.locomotion, frame, fps }, options.locomotion.options) : undefined;
  const activePreset = locomotion?.preset ?? preset;
  const clip = options.clip ?? createMotionClip(rig, activePreset, fps, options.durationSec ?? 2);
  let pose = sampleMotionClip(rig, clip, frame, fps);
  if (locomotion) pose = applyLocomotionPose(rig, pose, locomotion);
  if (options.footIK && ['walk', 'run', 'sprint'].includes(activePreset)) pose = applyFootIKToPose(rig, pose, evaluateFootContactPlan(rig, frame, fps, options.footIK), options.footIK);
  const contactOptions = locomotion ? { ...options.groundContact, rootVelocity: options.locomotion?.velocity ?? { x: 0, z: 0 }, strideLength: locomotion.strideLength, stepHeight: locomotion.stepHeight, cycleRate: locomotion.cycleRate } : options.groundContact;
  pose = applyRequestedIK(rig, pose, options.ik3D, options.fullBodyIK, options.balance, contactOptions, frame, fps, options.dynamicBalance);
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return pose;
}

export interface CharacterPerformance { motion: MotionPreset; expression?: CharacterExpression; expressionAtFrame?: number; }
export function updateCharacterPerformance(model: ProceduralCharacterModel, rig: CharacterRig, performance: CharacterPerformance, frame: number, fps: number, options: { durationSec?: number; clip?: MotionClip; unitScale?: number; footIK?: FootIKOptions; ik3D?: LimbIK3DRequest[]; fullBodyIK?: FullBodyIKOptions; balance?: BalanceOptions; groundContact?: GroundContactOptions; locomotion?: LocomotionInput & { options?: LocomotionOptions } } = {}): CharacterPose {
  const pose = updateThreeCharacterFrame(model.rig, rig, performance.motion, frame, fps, options);
  if (performance.expression && frame >= (performance.expressionAtFrame ?? 0) && model.appearance.expression !== performance.expression) updateCharacterExpression(model, performance.expression);
  return pose;
}
export interface FacialAnimationOptions { blinkIntervalSec?: number; blinkDurationSec?: number; gazeAmplitude?: number; }
export function updateCharacterFacialAnimation(model:ProceduralCharacterModel,frame:number,fps:number,options:FacialAnimationOptions={}):void {
  const safeFps=Math.max(1,fps), interval=Math.max(0.5,options.blinkIntervalSec??3.6)*safeFps, duration=Math.max(1,options.blinkDurationSec??0.12)*safeFps;
  const cycle=((Math.max(0,frame)%interval)+interval)%interval;
  setCharacterBlink(model,cycle<duration);
  const amplitude=Math.max(0,Math.min(0.012,options.gazeAmplitude??0.006)), phase=Math.max(0,frame)/safeFps;
  setCharacterGaze(model,Math.sin(phase*0.73)*amplitude,Math.sin(phase*0.41)*amplitude*0.55);
}
export function updateCharacterLipSync(model:ProceduralCharacterModel,track:LipSyncTrack,frame:number):void {
  const sample=sampleLipSync(track,frame); setCharacterViseme(model,sample.viseme,sample.strength);
}
export function updateCharacterActionSequence(model:ProceduralCharacterModel,rig:CharacterRig,sequence:CharacterActionSequence,frame:number,fps:number):CharacterActionFrame {
  const result=evaluateCharacterActionSequence(rig,sequence,frame,fps);
  updateThreeRigFromPose(model.rig,rig,result.pose);
  if(result.expression&&model.appearance.expression!==result.expression)updateCharacterExpression(model,result.expression);
  if(result.leftHand)setCharacterHandGesture(model,'left',result.leftHand);
  if(result.rightHand)setCharacterHandGesture(model,'right',result.rightHand);
  if(result.gaze)setCharacterGaze(model,result.gaze.x,result.gaze.y);
  if(result.viseme)setCharacterViseme(model,result.viseme);
  return result;
}
