import type { Vec3 } from '../core/types';
import type { CharacterPose, CharacterRig } from './rig';
import { evaluateRigWorldPose3D, solveLimbIK3D, type LimbIK3DRequest, type IK3DResult } from './ik3d';

export interface FullBodyIKOptions {
  requests: LimbIK3DRequest[];
  /** Revisit all constraints to reduce drift when chains share torso ancestors. */
  iterations?: number;
  /** Stop once every reachable target is within this world-space distance. */
  tolerance?: number;
}
export interface FullBodyIKConstraintResult {
  request: LimbIK3DRequest;
  result: IK3DResult;
  endPosition: Vec3;
  targetError: number;
}
export interface FullBodyIKResult {
  pose: CharacterPose;
  constraints: FullBodyIKConstraintResult[];
  converged: boolean;
  iterations: number;
}

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Coordinates several two-bone constraints in deterministic passes.
 * Each pass re-evaluates the shared hierarchy, so a later limb can account
 * for torso/ancestor rotations introduced by an earlier constraint.
 */
export function solveFullBodyIK3D(rig: CharacterRig, pose: CharacterPose, options: FullBodyIKOptions): FullBodyIKResult {
  if (pose.rigId !== rig.id) throw new Error('Pose rig id does not match the target rig.');
  if (!options.requests.length) return { pose, constraints: [], converged: true, iterations: 0 };
  const iterations = Math.max(1, Math.min(8, Math.floor(options.iterations ?? 3)));
  const tolerance = Math.max(0, options.tolerance ?? 0.015);
  let current = pose;
  let constraints: FullBodyIKConstraintResult[] = [];
  let completed = 0;

  for (let pass = 0; pass < iterations; pass += 1) {
    for (const request of options.requests) {
      const solved = solveLimbIK3D(rig, current, request);
      current = solved.pose;
    }
    completed = pass + 1;
    const world = evaluateRigWorldPose3D(rig, current);
    constraints = options.requests.map(request => {
      const endPosition = world.get(request.endJointId)?.position;
      if (!endPosition) throw new Error(`Full-body IK end joint not found: ${request.endJointId}`);
      const root = world.get(request.rootJointId)?.position;
      const middle = world.get(request.middleJointId)?.position;
      if (!root || !middle) throw new Error('Full-body IK chain references a missing joint.');
      const upperLength = distance(root, middle);
      const lowerLength = distance(middle, endPosition);
      const targetDistance = distance(root, request.target);
      const result = {
        root, middle, end: endPosition,
        reachable: targetDistance <= upperLength + lowerLength && targetDistance >= Math.abs(upperLength - lowerLength),
        distance: targetDistance,
      };
      return { request, result, endPosition, targetError: distance(endPosition, request.target) };
    });
    if (constraints.every(item => item.targetError <= tolerance)) break;
  }
  return {
    pose: current,
    constraints,
    converged: constraints.every(item => item.targetError <= tolerance),
    iterations: completed,
  };
}
