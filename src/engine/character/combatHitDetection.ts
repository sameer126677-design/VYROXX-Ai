import type { Vec3 } from '../core/types';
import { validateCombatHitbox, validateCombatHurtbox, type CombatHitbox, type CombatHurtbox } from './combatHitboxes';

export interface CombatHitContact {
  hitboxId: string;
  hurtboxId: string;
  attackerId: string;
  targetId: string;
  region: CombatHurtbox['region'];
  point: Vec3;
  normal: Vec3;
  distance: number;
  damage: number;
  knockback: number;
  frame: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const scale = (v: Vec3, n: number): Vec3 => ({ x:v.x*n, y:v.y*n, z:v.z*n });
const length = (v: Vec3) => Math.hypot(v.x,v.y,v.z);

/** Detects overlapping spherical hitboxes only during their authored active frames. */
export function detectCombatHits(
  hitboxes: CombatHitbox[],
  hurtboxes: CombatHurtbox[],
  frame: number
): CombatHitContact[] {
  if (!Number.isFinite(frame) || frame < 0) throw new Error('Combat detection frame must be non-negative.');
  const active = hitboxes.map(validateCombatHitbox).filter(hit =>
    frame >= hit.activeFromFrame && frame <= hit.activeUntilFrame
  );
  const targets = hurtboxes.map(validateCombatHurtbox).filter(box => box.enabled);
  const contacts: CombatHitContact[] = [];
  const seen = new Set<string>();
  for (const hit of active) {
    for (const hurt of targets) {
      if (hit.ownerCharacterId === hurt.characterId) continue;
      const delta = sub(hurt.center, hit.center);
      const distance = length(delta);
      if (distance > hit.radius + hurt.radius) continue;
      const normal = distance > 1e-8 ? scale(delta,1/distance) : { x:0, y:1, z:0 };
      const key = hit.id + '|' + hurt.id;
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({
        hitboxId: hit.id, hurtboxId: hurt.id,
        attackerId: hit.ownerCharacterId, targetId: hurt.characterId,
        region: hurt.region,
        point: add(hit.center,scale(normal,hit.radius)),
        normal, distance, damage: hit.damage, knockback: hit.knockback, frame
      });
    }
  }
  return contacts;
}
