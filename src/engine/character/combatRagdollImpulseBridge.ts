import type { CharacterRig } from './rig';
import type { CharacterPhysicsContact } from './collisionPhysics';
import type { CharacterRagdollState } from './characterRagdoll';
import { applyCharacterRagdollImpulse } from './characterRagdoll';
import type { Vec3 } from '../core/types';

export interface CombatRagdollImpulseOptions {
  intensityScale?: number;
  minimumPenetration?: number;
  maximumImpulse?: number;
  jointIds?: string[];
}
export interface CombatRagdollImpulseResult {
  state: CharacterRagdollState;
  appliedJointIds: string[];
  impulse: Vec3 | null;
}

/** Converts the strongest environment contact into a small authored angular impulse. */
export function applyCombatRagdollImpulseFromContacts(
  rig: CharacterRig,
  previous: CharacterRagdollState,
  contacts: CharacterPhysicsContact[],
  frame: number,
  options: CombatRagdollImpulseOptions = {}
): CombatRagdollImpulseResult {
  if (rig.id !== previous.rigId || rig.characterId !== previous.characterId ||
      !Number.isFinite(frame) || frame < previous.changedAtFrame) {
    throw new Error('Ragdoll impulse bridge rig or frame does not match its state.');
  }
  const scale = options.intensityScale ?? 2.5;
  const minimum = options.minimumPenetration ?? 0.005;
  const maximum = options.maximumImpulse ?? 4;
  if (![scale, minimum, maximum].every(Number.isFinite) || scale < 0 || minimum < 0 || maximum <= 0) {
    throw new Error('Ragdoll impulse bridge tuning is invalid.');
  }
  const contact = contacts
    .filter(item => Number.isFinite(item.penetration) && item.penetration >= minimum &&
      [item.normal.x, item.normal.y, item.normal.z].every(Number.isFinite))
    .slice()
    .sort((a, b) => b.penetration - a.penetration)[0];
  if (!contact || maximum === 0) return { state: previous, appliedJointIds: [], impulse: null };

  const magnitude = Math.min(maximum, contact.penetration * scale);
  const impulse: Vec3 = {
    x: -contact.normal.z * magnitude * 0.25,
    y: contact.normal.x * magnitude * 0.2,
    z: contact.normal.x * magnitude * 0.55 - contact.normal.y * magnitude * 0.1
  };
  const requested = options.jointIds?.length ? options.jointIds : ['spine', 'neck'];
  const jointIds = [...new Set(requested)].filter(id => rig.joints.some(joint => joint.id === id));
  const targets = jointIds.length ? jointIds : [rig.rootJointId];
  let state = previous;
  targets.forEach((jointId, index) => {
    const weight = index === 0 ? 1 : 0.55;
    state = applyCharacterRagdollImpulse(rig, state, jointId, {
      x: impulse.x * weight, y: impulse.y * weight, z: impulse.z * weight
    }, frame);
  });
  return { state, appliedJointIds: targets, impulse };
}
