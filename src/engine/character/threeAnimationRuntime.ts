import type { CharacterRig, CharacterPose } from './rig';
import type { CharacterExpression, ProceduralCharacterModel } from './proceduralCharacter';
import { updateCharacterExpression, setCharacterBlink, setCharacterGaze, setCharacterViseme } from './proceduralCharacter';
import { createMotionClip, sampleMotionClip, blendCharacterPoses, type MotionPreset, type MotionClip } from './animation';
import { createThreeRigRuntime, updateThreeRigFromPose, type ThreeRigOptions, type ThreeRigRuntime } from './threeRig';
import { sampleLipSync, type LipSyncTrack } from './lipSync';
import { evaluateCharacterActionSequence, type CharacterActionSequence, type CharacterActionFrame } from './actionSequence';
import { setCharacterHandGesture } from './proceduralCharacter';
import { applyFootIKToPose, evaluateFootContactPlan, type FootIKOptions } from './footIK';
import { solveLimbIK3D, type LimbIK3DRequest } from './ik3d';
import { solveFullBodyIK3D, type FullBodyIKOptions } from './fullBodyIK';
import { solveCharacterBalance3D, solveDynamicCharacterBalance3D, type BalanceOptions, type DynamicBalanceOptions } from './balance';
import { evaluateGroundContactPlan, applyGroundContactPlan, createFootPlantState, updateFootPlantTracker, type FootPlantState, type GroundContactPlan, type GroundContactOptions } from './groundContact';
import { evaluateLocomotionState, applyLocomotionPose, updateLocomotionController, createLocomotionControllerState, type LocomotionInput, type LocomotionOptions, type LocomotionControllerState } from './locomotion';
import { createFootstepEventState, detectFootstepEvents, type FootstepEvent, type FootstepEventState } from './locomotionEvents';
import { evaluateCharacterInteraction, type CharacterInteractionRequest, type CharacterInteractionResult } from './interaction';
import { transitionInteractionObject, type InteractionObjectState, type InteractionHand } from './objectInteraction';
import type { Object3D } from 'three';
import { evaluateCharacterPairInteraction, type CharacterPairInteractionRequest, type CharacterPairInteractionResult } from './pairInteraction';
import { transitionCharacterObjectHandover, type CharacterObjectHandoverState, type CharacterObjectHandoverEvent } from './objectHandover';
import { applyEnvironmentInteractionTransform, transitionEnvironmentInteraction, type EnvironmentInteractionState, type EnvironmentInteractionEvent } from './environmentInteraction';
import { applySharedPayloadTransform, evaluatePhysicalCoordination, type PhysicalCoordinationRequest, type PhysicalCoordinationState, type PhysicalCoordinationResult } from './physicalCoordination';
import { applyCharacterPhysicsTransform, stepCharacterPhysics, type CharacterPhysicsState, type CharacterCapsule, type EnvironmentCollider, type CharacterPhysicsOptions, type CharacterPhysicsStep } from './collisionPhysics';
import { applyDynamicBodyTransform, stepDynamicPhysics, type DynamicBodyDefinition, type DynamicBodyState, type DynamicPhysicsOptions, type DynamicPhysicsStep } from './dynamicObjectPhysics';
import { applyCharacterObjectForce, type CharacterObjectForceState, type CharacterObjectForceRequest, type CharacterObjectForceResult } from './characterObjectForce';
import { applyCharacterPairForce, type CharacterPairForceState, type CharacterPairForceRequest, type CharacterPairForceResult } from './characterPairForce';
import { recoverCharacterBalance, type CharacterBalanceRecoveryState, type CharacterBalanceRecoveryOptions, type CharacterBalanceRecoveryResult } from './characterBalanceRecovery';
import { applyCharacterRagdollImpulse, stepCharacterRagdoll, recoverCharacterFromRagdoll, type CharacterRagdollState, type CharacterRagdollOptions, type CharacterRagdollStep } from './characterRagdoll';
import { createCharacterImpactState, sampleCharacterImpactReaction, type CharacterImpactRequest, type CharacterImpactState, type CharacterImpactSample } from './characterImpactReaction';
import { createCharacterCombatState, startCharacterCombatMove, stepCharacterCombat, applyCharacterCombatDamage, recoverCharacterCombatStamina, type CharacterCombatState, type CombatCommand, type CombatMoveDefinition, type CombatTransition } from './characterCombat';
import { detectCombatHits, type CombatHitContact } from './combatHitDetection';
import { resolveCombatHit, type CombatResolutionResult } from './combatResolution';
import type { CombatHitbox, CombatHurtbox } from './combatHitboxes';
import { advanceCombatCombo, createCombatComboState, type CombatComboDefinition, type CombatComboState, type CombatComboResult } from './combatCombo';

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
  locomotionState: LocomotionControllerState;
  groundContactPlan: GroundContactPlan;
  footstepEvents: FootstepEvent[];
  footstepEventState: FootstepEventState;
  frame: number;
}
export interface StatefulThreeCharacterFrameOptions {
  durationSec?: number;
  clip?: MotionClip;
  unitScale?: number;
  groundContact?: GroundContactOptions;
  locomotion?: LocomotionInput & { options?: LocomotionOptions };
  locomotionState?: LocomotionControllerState;
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
  options: StatefulThreeCharacterFrameOptions = {},
  previousLocomotionState: LocomotionControllerState = options.locomotionState ?? createLocomotionControllerState(options.locomotion?.heading ?? 0),
  previousFootstepState: FootstepEventState = createFootstepEventState(rig.id)
): StatefulThreeCharacterFrameResult {
  const controlledLocomotion = options.locomotion
    ? updateLocomotionController(options.locomotion, frame, fps, previousLocomotionState, options.locomotion.options)
    : undefined;
  const locomotion = controlledLocomotion?.state;
  const activePreset = locomotion?.preset ?? preset;
  const clip = options.clip ?? createMotionClip(rig, activePreset, fps, options.durationSec ?? 2);
  let pose = sampleMotionClip(rig, clip, frame, fps, locomotion?.phase);
  if (locomotion && locomotion.previousPreset !== locomotion.preset && locomotion.transitionProgress < 1) {
    const fromClip = createMotionClip(rig, locomotion.previousPreset, fps, options.durationSec ?? 2);
    const fromPose = sampleMotionClip(rig, fromClip, frame, fps, locomotion.phase);
    const t = locomotion.transitionProgress;
    const eased = t * t * (3 - 2 * t);
    pose = blendCharacterPoses(fromPose, pose, eased);
  }
  if (locomotion) pose = applyLocomotionPose(rig, pose, locomotion);
  const contactOptions: GroundContactOptions = {
    ...options.groundContact,
    ...(locomotion ? {
      rootVelocity: locomotion ? { x: locomotion.speed * Math.sin(locomotion.heading), z: locomotion.speed * Math.cos(locomotion.heading) } : { x: 0, z: 0 },
      strideLength: locomotion.strideLength,
      stepHeight: locomotion.stepHeight,
      cycleRate: locomotion.cycleRate
    } : {})
  };
  const tracked = updateFootPlantTracker(rig, frame, fps, previousState, contactOptions);
  const footsteps = detectFootstepEvents(rig.id, frame, tracked.plan, previousFootstepState, { stanceRatio: contactOptions.stanceRatio, speed: locomotion?.speed ?? 0 });
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
        velocity: options.dynamicBalance.velocity ?? (locomotion ? { x: locomotion.speed * Math.sin(locomotion.heading), z: locomotion.speed * Math.cos(locomotion.heading) } : undefined)
      }).pose;
    } else if (options.balance) {
      pose = solveCharacterBalance3D(rig, pose, { ...options.balance, supportPoints }).pose;
    }
  }
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return { pose, footPlantState: tracked.state, locomotionState: controlledLocomotion?.controllerState ?? previousLocomotionState, groundContactPlan: tracked.plan, footstepEvents: footsteps.events, footstepEventState: footsteps.state, frame };
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


/** Applies a targeted reach/grab/push/pull pose to the procedural character runtime. */
export function updateCharacterInteraction(model: ProceduralCharacterModel, rig: CharacterRig, pose: CharacterPose, request: CharacterInteractionRequest): CharacterInteractionResult {
  const result = evaluateCharacterInteraction(rig, pose, request);
  updateThreeRigFromPose(model.rig, rig, result.pose);
  setCharacterHandGesture(model, request.hand, result.gesture);
  return result;
}


/** Parents a scene object to the selected wrist anchor while preserving world transform. */
export function attachInteractionObject(model: ProceduralCharacterModel, object: Object3D, hand: InteractionHand): void {
  const anchor = model.anchors.get(hand === 'left' ? 'left-wrist' : 'right-wrist');
  if (!anchor) throw new Error(`Missing ${hand} wrist anchor.`);
  model.root.updateMatrixWorld(true);
  object.updateWorldMatrix(true, false);
  anchor.attach(object);
  model.root.updateMatrixWorld(true);
}

/** Releases an attached object into the character's scene parent, preserving its world transform. */
export function detachInteractionObject(model: ProceduralCharacterModel, object: Object3D): void {
  const destination = model.root.parent ?? model.root;
  destination.updateWorldMatrix(true, false);
  object.updateWorldMatrix(true, false);
  destination.attach(object);
  destination.updateMatrixWorld(true);
}

/** Updates serializable ownership state and performs the matching scene attachment operation. */
export function updateInteractionObjectState(
  model: ProceduralCharacterModel,
  object: Object3D,
  previous: InteractionObjectState,
  command: { type: 'grab'; hand: InteractionHand; frame: number } | { type: 'release'; frame: number }
): InteractionObjectState {
  const next = transitionInteractionObject(previous, { ...command, ...(command.type === 'grab' ? { ownerCharacterId: model.appearance.id } : {}) });
  if (next === previous) return previous;
  if (command.type === 'grab') attachInteractionObject(model, object, command.hand);
  else if (previous.status === 'held') detachInteractionObject(model, object);
  return next;
}

/** Transfers an attached object directly between two characters while preserving its world transform. */
export function transferInteractionObjectState(
  fromModel: ProceduralCharacterModel,
  toModel: ProceduralCharacterModel,
  object: Object3D,
  previous: InteractionObjectState,
  command: { hand: InteractionHand; frame: number }
): InteractionObjectState {
  if (fromModel === toModel || fromModel.root === toModel.root) throw new Error('Object transfer requires two separate character models.');
  if (previous.status !== 'held') throw new Error('Only a held object can be transferred.');
  if (previous.ownerCharacterId && previous.ownerCharacterId !== fromModel.appearance.id) throw new Error('The source character does not own this object.');
  const next = transitionInteractionObject(previous, { type: 'transfer', hand: command.hand, frame: command.frame, ownerCharacterId: toModel.appearance.id });
  if (next === previous) return previous;
  attachInteractionObject(toModel, object, command.hand);
  return next;
}


/** Evaluates and applies a coordinated two-character interaction to separate procedural models. */
export function updateCharacterPairInteraction(firstModel: ProceduralCharacterModel, secondModel: ProceduralCharacterModel, request: CharacterPairInteractionRequest): CharacterPairInteractionResult {
  if (firstModel === secondModel || firstModel.root === secondModel.root) throw new Error('Pair interaction requires two separate character models.');
  const result = evaluateCharacterPairInteraction(request);
  updateThreeRigFromPose(firstModel.rig, request.firstRig, result.firstPose);
  updateThreeRigFromPose(secondModel.rig, request.secondRig, result.secondPose);
  setCharacterHandGesture(firstModel, request.firstHand, result.first.gesture);
  setCharacterHandGesture(secondModel, request.secondHand, result.second.gesture);
  return result;
}


/** Runs a coordinated two-character handover and commits the scene-graph ownership change at the transfer phase. */
export function updateCharacterObjectHandover(
  sourceModel: ProceduralCharacterModel,
  receiverModel: ProceduralCharacterModel,
  object: Object3D,
  request: CharacterPairInteractionRequest,
  previous: CharacterObjectHandoverState,
  event: CharacterObjectHandoverEvent
): { interaction: CharacterPairInteractionResult; state: CharacterObjectHandoverState } {
  if (request.action !== 'handover') throw new Error('Object handover requires a pair interaction with action "handover".');
  if (sourceModel.appearance.id !== previous.sourceCharacterId || receiverModel.appearance.id !== previous.receiverCharacterId) {
    throw new Error('Handover models do not match the source and receiver recorded in the handover state.');
  }
  if (request.firstHand !== previous.sourceHand || request.secondHand !== previous.receiverHand) {
    throw new Error('Pair interaction hands do not match the handover state.');
  }
  const interaction = updateCharacterPairInteraction(sourceModel, receiverModel, request);
  const currentEvent = event.type === 'complete' ? event : { ...event, interaction };
  const state = transitionCharacterObjectHandover(previous, currentEvent);
  if (event.type !== 'transfer') return { interaction, state };
  const objectState = transferInteractionObjectState(sourceModel, receiverModel, object, previous.objectState, {
    hand: previous.receiverHand, frame: event.frame
  });
  return { interaction, state: { ...state, objectState } };
}


/** Directs a character's selected hand toward an environment prop interaction point. */
export function updateCharacterEnvironmentInteraction(
  model: ProceduralCharacterModel,
  rig: CharacterRig,
  pose: CharacterPose,
  request: CharacterInteractionRequest
): CharacterInteractionResult {
  return updateCharacterInteraction(model, rig, pose, request);
}

/** Advances a caller-owned prop timeline state and applies its deterministic Three.js local transform. */
export function updateEnvironmentObjectInteraction(
  object: Object3D,
  previous: EnvironmentInteractionState,
  event: EnvironmentInteractionEvent
): EnvironmentInteractionState {
  const state = transitionEnvironmentInteraction(previous, event);
  applyEnvironmentInteractionTransform(object, state, event.frame);
  return state;
}

/** Re-samples an environment prop at an arbitrary timeline frame, including backward timeline seeking. */
export function sampleEnvironmentObjectInteraction(
  object: Object3D,
  state: EnvironmentInteractionState,
  frame: number
): void {
  applyEnvironmentInteractionTransform(object, state, frame);
}


/** Updates both character rigs and their shared payload from one coordinated timeline sample. */
export function updateCharacterPhysicalCoordination(
  firstModel: ProceduralCharacterModel,
  secondModel: ProceduralCharacterModel,
  payload: Object3D,
  request: PhysicalCoordinationRequest,
  state: PhysicalCoordinationState,
  frame: number
): PhysicalCoordinationResult {
  if (firstModel.appearance.id !== state.firstCharacterId || secondModel.appearance.id !== state.secondCharacterId) {
    throw new Error('Physical coordination models do not match the character ids in state.');
  }
  if (firstModel.rig.root === secondModel.rig.root) throw new Error('Physical coordination requires two distinct character model runtimes.');
  const result = evaluatePhysicalCoordination(request, state, frame);
  updateThreeRigFromPose(firstModel.rig, request.firstRig, result.firstPose);
  updateThreeRigFromPose(secondModel.rig, request.secondRig, result.secondPose);
  applySharedPayloadTransform(payload, state, frame);
  return result;
}


/** Steps lightweight capsule collision physics and applies the resulting root transform to a procedural character. */
export function updateCharacterCollisionPhysics(
  model: ProceduralCharacterModel,
  previous: CharacterPhysicsState,
  capsule: CharacterCapsule,
  colliders: EnvironmentCollider[],
  frame: number,
  fps: number,
  options: CharacterPhysicsOptions = {}
): CharacterPhysicsStep {
  if (model.appearance.id !== previous.characterId) {
    throw new Error('Procedural character does not match the collision physics state.');
  }
  const result = stepCharacterPhysics(previous,capsule,colliders,frame,fps,options);
  applyCharacterPhysicsTransform(model.root,result.state);
  return result;
}


/** Advances a group of dynamic scene objects and applies their Three.js transforms. */
export function updateDynamicSceneObjects(
  objects: Map<string,Object3D>,
  definitions: DynamicBodyDefinition[],
  previousStates: DynamicBodyState[],
  frame: number,
  fps: number,
  options: DynamicPhysicsOptions = {}
): DynamicPhysicsStep {
  const result=stepDynamicPhysics(definitions,previousStates,frame,fps,options);
  for(const state of result.states){
    const object=objects.get(state.id);
    if(!object)throw new Error(`Missing Three.js object for dynamic body "${state.id}".`);
    applyDynamicBodyTransform(object,state);
  }
  return result;
}


/** Bridges a confirmed character hand interaction into the next dynamic-object physics state. */
export function updateCharacterObjectForce(
  definition: DynamicBodyDefinition,
  bodyState: DynamicBodyState,
  previous: CharacterObjectForceState,
  request: CharacterObjectForceRequest,
  interaction: CharacterInteractionResult
): CharacterObjectForceResult {
  return applyCharacterObjectForce(definition, bodyState, previous, request, interaction);
}


/** Bridges a confirmed two-character hand interaction into both character physics velocities. */
export function updateCharacterPairForce(
  previous: CharacterPairForceState,
  firstPrevious: CharacterPhysicsState,
  secondPrevious: CharacterPhysicsState,
  request: CharacterPairForceRequest,
  interaction: CharacterPairInteractionResult
): CharacterPairForceResult {
  return applyCharacterPairForce(previous, firstPrevious, secondPrevious, request, interaction);
}


/** Applies predictive balance recovery to a procedural character and retains its updated physics velocity. */
export function updateCharacterBalanceRecovery(
  model: ProceduralCharacterModel,
  rig: CharacterRig,
  pose: CharacterPose,
  physics: CharacterPhysicsState,
  previous: CharacterBalanceRecoveryState,
  frame: number,
  fps: number,
  options: CharacterBalanceRecoveryOptions
): CharacterBalanceRecoveryResult {
  if (model.appearance.id !== previous.characterId) {
    throw new Error('Procedural character does not match the balance recovery state.');
  }
  const result = recoverCharacterBalance(rig, pose, physics, previous, frame, fps, options);
  updateThreeRigFromPose(model.rig, rig, result.pose);
  return result;
}


/** Applies an authored angular impulse and returns the updated procedural ragdoll state. */
export function triggerCharacterRagdoll(
  rig: CharacterRig,
  previous: CharacterRagdollState,
  jointId: string,
  impulse: { x: number; y: number; z: number },
  frame: number
): CharacterRagdollState {
  return applyCharacterRagdollImpulse(rig, previous, jointId, impulse, frame);
}

/** Advances ragdoll joint motion and applies the resulting pose to the procedural model. */
export function updateCharacterRagdoll(
  model: ProceduralCharacterModel,
  rig: CharacterRig,
  previous: CharacterRagdollState,
  frame: number,
  fps: number,
  options: CharacterRagdollOptions = {}
): CharacterRagdollStep {
  if (model.appearance.id !== previous.characterId) {
    throw new Error('Procedural character does not match the ragdoll state.');
  }
  const result = stepCharacterRagdoll(rig, previous, frame, fps, options);
  updateThreeRigFromPose(model.rig, rig, result.pose);
  return result;
}

/** Blends the ragdoll pose into an authored get-up pose and applies it to the model. */
export function updateCharacterRagdollRecovery(
  model: ProceduralCharacterModel,
  rig: CharacterRig,
  previous: CharacterRagdollState,
  getUpPose: CharacterPose,
  frame: number,
  durationFrames?: number
): CharacterRagdollStep {
  if (model.appearance.id !== previous.characterId) {
    throw new Error('Procedural character does not match the ragdoll recovery state.');
  }
  const result = recoverCharacterFromRagdoll(rig, previous, getUpPose, frame, durationFrames);
  updateThreeRigFromPose(model.rig, rig, result.pose);
  return result;
}


/** Creates a deterministic impact reaction for a specific character and hit region. */
export function createCharacterImpactReaction(
  rig: CharacterRig,
  request: CharacterImpactRequest
): CharacterImpactState {
  return createCharacterImpactState(rig, request);
}

/** Samples and applies a hit reaction over the supplied base animation pose. */
export function updateCharacterImpactReaction(
  model: ProceduralCharacterModel,
  rig: CharacterRig,
  basePose: CharacterPose,
  state: CharacterImpactState,
  frame: number
): CharacterImpactSample {
  if (model.appearance.id !== state.characterId) {
    throw new Error('Procedural character does not match the impact reaction state.');
  }
  const result = sampleCharacterImpactReaction(rig, basePose, state, frame);
  updateThreeRigFromPose(model.rig, rig, result.pose);
  return result;
}


/** Creates the gameplay combat state for one procedural character. */
export function createThreeCharacterCombatState(
  characterId: string,
  frame = 0,
  health = 100,
  stamina = 100
): CharacterCombatState {
  return createCharacterCombatState(characterId, frame, health, stamina);
}

/** Starts an authored attack, block, dodge, stagger or counter move. */
export function triggerThreeCharacterCombatMove(
  previous: CharacterCombatState,
  command: CombatCommand
): CombatTransition {
  return startCharacterCombatMove(previous, command);
}

/** Advances a combat move through its startup, active and recovery frames. */
export function updateThreeCharacterCombat(
  previous: CharacterCombatState,
  move: CombatMoveDefinition,
  frame: number
): CombatTransition {
  return stepCharacterCombat(previous, move, frame);
}

/** Applies externally confirmed damage and updates the character's combat state. */
export function applyThreeCharacterCombatDamage(
  previous: CharacterCombatState,
  damage: number,
  frame: number
): CharacterCombatState {
  return applyCharacterCombatDamage(previous, damage, frame);
}

/** Restores authored stamina between combat actions. */
export function recoverThreeCharacterCombatStamina(
  previous: CharacterCombatState,
  amount: number,
  frame: number
): CharacterCombatState {
  return recoverCharacterCombatStamina(previous, amount, frame);
}


/** Detects active attack volumes overlapping another character's hurt volumes. */
export function detectThreeCharacterCombatHits(
  hitboxes: CombatHitbox[],
  hurtboxes: CombatHurtbox[],
  frame: number
): CombatHitContact[] {
  return detectCombatHits(hitboxes,hurtboxes,frame);
}

/** Resolves one confirmed contact against the matching target combat state. */
export function resolveThreeCharacterCombatHit(
  targetState: CharacterCombatState,
  contact: CombatHitContact
): CombatResolutionResult {
  return resolveCombatHit(targetState,contact);
}

/** Creates an empty combo input state. */
export function createThreeCharacterComboState(): CombatComboState {
  return createCombatComboState();
}

/** Advances an authored combo from a timestamped player or AI input. */
export function updateThreeCharacterCombo(
  definition: CombatComboDefinition,
  previous: CombatComboState,
  input: string,
  frame: number
): CombatComboResult {
  return advanceCombatCombo(definition,previous,input,frame);
}

import { createCombatGuardState, updateCombatGuard, type CombatGuardState } from './combatGuard';
import { resolveCombatDefense, type CombatDefenseResult } from './combatDefenseResolution';
import { createCombatStatusState, applyCombatStatusEffect, stepCombatStatusEffects, type CombatStatusState, type CombatStatusEffect } from './combatStatusEffects';
import { selectCombatTarget, type CombatTargetCandidate, type CombatTargetResult } from './combatTargeting';

/** Creates a persistent guard/parry state for a character. */
export function createThreeCharacterGuardState(characterId:string,frame=0,stamina=100,maxStamina=100):CombatGuardState {
  return createCombatGuardState(characterId,frame,stamina,maxStamina);
}
/** Raises/lowers a guard and optionally opens a short parry window on the rising edge. */
export function updateThreeCharacterGuard(previous:CombatGuardState,command:{active:boolean;facing:{x:number;y:number;z:number};frame:number;parryWindowFrames?:number;guardBreakFrames?:number}):CombatGuardState {
  return updateCombatGuard(previous,command);
}
/** Resolves a detected hit against the target's current guard state. */
export function resolveThreeCharacterCombatDefense(contact:CombatHitContact,guard:CombatGuardState,options?:Parameters<typeof resolveCombatDefense>[2]):CombatDefenseResult {
  return resolveCombatDefense(contact,guard,options);
}
/** Creates caller-owned status-effect state for one combatant. */
export function createThreeCharacterCombatStatus(characterId:string,frame=0):CombatStatusState {
  return createCombatStatusState(characterId,frame);
}
/** Applies or refreshes a timed combat status effect. */
export function applyThreeCharacterCombatStatus(previous:CombatStatusState,effect:CombatStatusEffect,policy:'refresh'|'extend'|'replace'='refresh'):CombatStatusState {
  return applyCombatStatusEffect(previous,effect,policy);
}
/** Expires timed combat statuses at the requested deterministic frame. */
export function updateThreeCharacterCombatStatuses(previous:CombatStatusState,frame:number):CombatStatusState {
  return stepCombatStatusEffects(previous,frame);
}
/** Selects the nearest eligible target, optionally constrained by facing and range. */
export function selectThreeCharacterCombatTarget(ownerId:string,origin:{x:number;y:number;z:number},candidates:CombatTargetCandidate[],options?:Parameters<typeof selectCombatTarget>[3]):CombatTargetResult {
  return selectCombatTarget(ownerId,origin,candidates,options);
}

import { applyCombatWeaponToMove, applyCombatWeaponToHitbox, type CombatWeaponProfile } from './combatWeapons';
import { resolveCombatArmor, type CombatArmorProfile, type CombatArmorResult } from './combatArmor';
import { chooseCombatAIAction, type CombatAIContext, type CombatAIOptions, type CombatAIChoice } from './combatAI';
import { createCombatEventLedger, appendCombatEvent, readCombatEvents, type CombatEventLedger, type CombatEventRecord } from './combatEventLedger';

/** Applies weapon tuning to an authored move before it is submitted to the combat state machine. */
export function prepareThreeCharacterWeaponMove(move:CombatMoveDefinition,weapon:CombatWeaponProfile):CombatMoveDefinition {
  return applyCombatWeaponToMove(move,weapon);
}
/** Applies weapon tuning to an authored world-space attack volume. */
export function prepareThreeCharacterWeaponHitbox(hitbox:CombatHitbox,weapon:CombatWeaponProfile):CombatHitbox {
  return applyCombatWeaponToHitbox(hitbox,weapon);
}
/** Resolves armor mitigation for a detected contact; caller retains the returned durability state. */
export function resolveThreeCharacterCombatArmor(contact:CombatHitContact,armor:CombatArmorProfile):CombatArmorResult {
  return resolveCombatArmor(contact,armor);
}
/** Chooses a deterministic rule-based combat action for an AI-controlled character. */
export function chooseThreeCharacterCombatAI(context:CombatAIContext,moves:CombatMoveDefinition[],options?:CombatAIOptions):CombatAIChoice {
  return chooseCombatAIAction(context,moves,options);
}
/** Creates a timeline ledger for combat events. */
export function createThreeCharacterCombatEventLedger(frame=0):CombatEventLedger {
  return createCombatEventLedger(frame);
}
/** Records a combat event once, ignoring duplicate event ids. */
export function recordThreeCharacterCombatEvent(previous:CombatEventLedger,event:CombatEventRecord):CombatEventLedger {
  return appendCombatEvent(previous,event);
}
/** Reads a chronological combat event range for replay or UI presentation. */
export function readThreeCharacterCombatEvents(ledger:CombatEventLedger,fromFrame=0,toFrame=Infinity):CombatEventRecord[] {
  return readCombatEvents(ledger,fromFrame,toFrame);
}

import { createCombatMovementState, sampleCombatMovement, type CombatMovementRequest, type CombatMovementState, type CombatMovementSample } from './combatMovement';
import { evaluateCombatSpacing, type CombatSpacingOptions, type CombatSpacingResult } from './combatSpacing';
import { sampleCombatAnimation, type CombatAnimationRequest } from './combatAnimation';
import { sampleCombatMoveTimeline, type CombatMoveTimelineSample } from './combatMoveTimeline';

/** Starts a caller-owned tactical movement command such as dodge, strafe or retreat. */
export function createThreeCharacterCombatMovement(request:CombatMovementRequest):CombatMovementState {
  return createCombatMovementState(request);
}
/** Samples tactical movement velocity/displacement; caller applies it to character physics/root. */
export function updateThreeCharacterCombatMovement(state:CombatMovementState,frame:number):CombatMovementSample {
  return sampleCombatMovement(state,frame);
}
/** Classifies target spacing and reports preferred-distance correction and attack reach. */
export function evaluateThreeCharacterCombatSpacing(distance:number,options?:CombatSpacingOptions):CombatSpacingResult {
  return evaluateCombatSpacing(distance,options);
}
/** Blends a stylized combat action overlay onto the supplied base animation pose. */
export function updateThreeCharacterCombatAnimation(model:ProceduralCharacterModel,rig:CharacterRig,basePose:CharacterPose,request:CombatAnimationRequest,frame:number):CharacterPose {
  if(model.appearance.id!==rig.characterId)throw new Error('Combat animation model and rig do not match.');
  const pose=sampleCombatAnimation(rig,basePose,request,frame);
  updateThreeRigFromPose(model.rig,rig,pose);
  return pose;
}
/** Samples startup, active and recovery phases for an authored combat move. */
export function sampleThreeCharacterCombatMoveTimeline(move:CombatMoveDefinition,startedAtFrame:number,frame:number):CombatMoveTimelineSample {
  return sampleCombatMoveTimeline(move,startedAtFrame,frame);
}

import { createCombatEvadeState, sampleCombatEvade, type CombatEvadeState } from './combatEvade';
import { applyCombatKnockback, type CombatKnockbackOptions, type CombatKnockbackResult } from './combatKnockback';
import { applyCombatContactReaction, type CombatImpactBridgeResult } from './combatImpactBridge';
import { createCombatEncounterState, updateCombatEncounter, type CombatEncounterState } from './combatEncounter';

/** Creates a timed dodge/evasion window with optional authored invulnerability frames. */
export function createThreeCharacterCombatEvade(characterId:string,frame:number,durationFrames:number,direction:{x:number;y:number;z:number},invulnerabilityStart=0,invulnerabilityDuration=0):CombatEvadeState {
  return createCombatEvadeState(characterId,frame,durationFrames,direction,invulnerabilityStart,invulnerabilityDuration);
}
/** Samples active dodge and invulnerability windows at a timeline frame. */
export function updateThreeCharacterCombatEvade(previous:CombatEvadeState,frame:number):ReturnType<typeof sampleCombatEvade> {
  return sampleCombatEvade(previous,frame);
}
/** Applies a confirmed combat contact as an impulse to character physics velocity. */
export function applyThreeCharacterCombatKnockback(previous:CharacterPhysicsState,contact:CombatHitContact,options?:CombatKnockbackOptions):CombatKnockbackResult {
  return applyCombatKnockback(previous,contact,options);
}
/** Converts a detected combat contact into a procedural impact pose over the supplied base pose. */
export function updateThreeCharacterCombatImpact(rig:CharacterRig,basePose:CharacterPose,contact:CombatHitContact,kind:'punch'|'kick'|'collision'|'fall'='punch',intensity=1):CombatImpactBridgeResult {
  return applyCombatContactReaction(rig,basePose,contact,kind,intensity);
}
/** Combines combat, guard and status state into one caller-owned encounter snapshot. */
export function createThreeCharacterCombatEncounter(combat:CharacterCombatState,guard:CombatGuardState,statuses:CombatStatusState):CombatEncounterState {
  return createCombatEncounterState(combat,guard,statuses);
}
/** Advances the combined encounter snapshot without taking ownership of its component states. */
export function updateThreeCharacterCombatEncounter(previous:CombatEncounterState,combat:CharacterCombatState,guard:CombatGuardState,statuses:CombatStatusState,frame:number):CombatEncounterState {
  return updateCombatEncounter(previous,combat,guard,statuses,frame);
}
