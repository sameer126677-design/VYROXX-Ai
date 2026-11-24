import type { CharacterCapsule, CharacterPhysicsOptions, CharacterPhysicsState, EnvironmentCollider } from './collisionPhysics';
import { stepCharacterPhysics } from './collisionPhysics';
import type { CharacterPose, CharacterRig } from './rig';
import type { CharacterRagdollOptions, CharacterRagdollState } from './characterRagdoll';
import { recoverCharacterFromRagdoll, stepCharacterRagdoll } from './characterRagdoll';
import {
  createCombatRagdollGroundingState, updateCombatRagdollGrounding,
  type CombatRagdollGroundingOptions, type CombatRagdollGroundingState
} from './combatRagdollGrounding';
import {
  canStartCombatRagdollRecovery, type CombatRagdollRecoveryGateOptions
} from './combatRagdollRecoveryGate';

export interface CombatRagdollPipelineOptions {
  physics?: CharacterPhysicsOptions;
  ragdoll?: CharacterRagdollOptions;
  grounding?: CombatRagdollGroundingOptions;
  recoveryGate?: CombatRagdollRecoveryGateOptions;
  autoRecover?: boolean;
  recoveryDurationFrames?: number;
}
export interface CombatRagdollPipelineResult {
  physics: CharacterPhysicsState;
  ragdoll: CharacterRagdollState;
  grounding: CombatRagdollGroundingState;
  pose: CharacterPose;
  startedRecovery: boolean;
  recoveryComplete: boolean;
  recoveryAllowed: boolean;
}

/** Steps world collision and angular ragdoll, then optionally starts a grounded get-up blend. */
export function stepCombatRagdollPipeline(
  rig: CharacterRig,
  previousPhysics: CharacterPhysicsState,
  previousRagdoll: CharacterRagdollState,
  previousGrounding: CombatRagdollGroundingState,
  capsule: CharacterCapsule,
  colliders: EnvironmentCollider[],
  basePose: CharacterPose,
  frame: number,
  fps: number,
  getUpPose?: CharacterPose,
  options: CombatRagdollPipelineOptions = {}
): CombatRagdollPipelineResult {
  if (rig.characterId !== previousPhysics.characterId || rig.characterId !== previousRagdoll.characterId ||
      rig.id !== previousRagdoll.rigId || rig.id !== basePose.rigId ||
      frame < previousPhysics.changedAtFrame || frame < previousRagdoll.changedAtFrame ||
      frame < previousGrounding.changedAtFrame) {
    throw new Error('Ragdoll pipeline character, rig, pose or frame does not match.');
  }
  const physicsStep = stepCharacterPhysics(previousPhysics, capsule, colliders, frame, fps, options.physics);
  let ragdoll = previousRagdoll;
  let pose = basePose;
  let recoveryComplete = false;

  if (previousRagdoll.phase === 'falling' || previousRagdoll.phase === 'ragdoll') {
    const angularStep = stepCharacterRagdoll(rig, previousRagdoll, frame, fps, options.ragdoll);
    ragdoll = angularStep.state;
    pose = angularStep.pose;
  } else if (previousRagdoll.phase === 'recovering') {
    if (!getUpPose) throw new Error('A get-up pose is required while ragdoll recovery is active.');
    const recovery = recoverCharacterFromRagdoll(
      rig, previousRagdoll, getUpPose, frame, options.recoveryDurationFrames
    );
    ragdoll = recovery.state;
    pose = recovery.pose;
    recoveryComplete = recovery.state.phase === 'animated';
  } else {
    ragdoll = { ...previousRagdoll, changedAtFrame: frame };
    pose = { ...basePose, frame };
  }

  const grounding = updateCombatRagdollGrounding(
    previousGrounding, physicsStep.state, ragdoll, frame, options.grounding
  ).state;
  const gate = canStartCombatRagdollRecovery(
    ragdoll, physicsStep.state, grounding, options.recoveryGate
  );
  let startedRecovery = false;

  if (options.autoRecover && gate.allowed) {
    if (!getUpPose) throw new Error('A get-up pose is required when automatic ragdoll recovery is enabled.');
    const recovery = recoverCharacterFromRagdoll(
      rig, ragdoll, getUpPose, frame, options.recoveryDurationFrames
    );
    ragdoll = recovery.state;
    pose = recovery.pose;
    startedRecovery = recovery.state.phase === 'recovering';
    recoveryComplete = recovery.state.phase === 'animated';
  }
  return {
    physics: physicsStep.state,
    ragdoll,
    grounding,
    pose,
    startedRecovery,
    recoveryComplete,
    recoveryAllowed: gate.allowed
  };
}
