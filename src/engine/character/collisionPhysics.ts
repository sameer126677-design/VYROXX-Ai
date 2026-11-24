import type { Object3D } from 'three';
import type { Vec3 } from '../core/types';

export interface PhysicsAabb { min: Vec3; max: Vec3; }
export interface PhysicsSphere { center: Vec3; radius: number; }
export type EnvironmentCollider =
  | { id: string; kind: 'box'; bounds: PhysicsAabb; restitution?: number; friction?: number }
  | { id: string; kind: 'sphere'; sphere: PhysicsSphere; restitution?: number; friction?: number };

export interface CharacterCapsule {
  radius: number;
  /** Total capsule height, including both hemispherical ends. */
  height: number;
}
export interface CharacterPhysicsState {
  characterId: string;
  position: Vec3;
  velocity: Vec3;
  grounded: boolean;
  changedAtFrame: number;
}
export interface CharacterPhysicsOptions {
  gravity?: number;
  groundY?: number;
  linearDamping?: number;
  restitution?: number;
  friction?: number;
  maxSubstepSec?: number;
  solverIterations?: number;
}
export interface CharacterPhysicsContact {
  colliderId: string;
  normal: Vec3;
  penetration: number;
}
export interface CharacterPhysicsStep {
  state: CharacterPhysicsState;
  contacts: CharacterPhysicsContact[];
  grounded: boolean;
  appliedGravity: number;
}

const EPSILON = 1e-8;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x*b.x + a.y*b.y + a.z*b.z;
const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
const normalize = (v: Vec3): Vec3 => { const n = length(v); return n > EPSILON ? scale(v, 1/n) : { x: 0, y: 1, z: 0 }; };
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const finiteVec = (v: Vec3): boolean => [v.x,v.y,v.z].every(Number.isFinite);

function validateCollider(collider: EnvironmentCollider): void {
  if (!collider.id.trim()) throw new Error('Environment collider requires a stable id.');
  if (collider.kind === 'box') {
    const { min, max } = collider.bounds;
    if (!finiteVec(min) || !finiteVec(max) || min.x > max.x || min.y > max.y || min.z > max.z) {
      throw new Error(`Invalid AABB bounds for collider "${collider.id}".`);
    }
  } else if (!finiteVec(collider.sphere.center) || !Number.isFinite(collider.sphere.radius) || collider.sphere.radius <= 0) {
    throw new Error(`Invalid sphere collider "${collider.id}".`);
  }
  for (const value of [collider.restitution, collider.friction]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
      throw new Error(`Collider "${collider.id}" restitution/friction must be between 0 and 1.`);
    }
  }
}

/** Creates a validated character physics state. Position is the character's root/feet origin. */
export function createCharacterPhysicsState(
  characterId: string,
  position: Vec3,
  frame = 0,
): CharacterPhysicsState {
  if (!characterId.trim() || !finiteVec(position) || !Number.isFinite(frame) || frame < 0) {
    throw new Error('Character physics state requires an id, finite position and non-negative frame.');
  }
  return { characterId, position: { ...position }, velocity: { x: 0, y: 0, z: 0 }, grounded: false, changedAtFrame: frame };
}

function capsuleSegment(position: Vec3, capsule: CharacterCapsule): { bottom: number; top: number } {
  if (!Number.isFinite(capsule.radius) || !Number.isFinite(capsule.height) || capsule.radius <= 0 || capsule.height < capsule.radius*2) {
    throw new Error('Character capsule requires a positive radius and height at least twice its radius.');
  }
  return { bottom: position.y + capsule.radius, top: position.y + capsule.height - capsule.radius };
}

function collideCapsuleSphere(
  position: Vec3, capsule: CharacterCapsule, collider: Extract<EnvironmentCollider,{kind:'sphere'}>
): CharacterPhysicsContact | null {
  const segment = capsuleSegment(position,capsule), center = collider.sphere.center;
  const closestY = clamp(center.y,segment.bottom,segment.top);
  const delta = { x: position.x-center.x, y: closestY-center.y, z: position.z-center.z };
  const distance = length(delta), penetration = capsule.radius + collider.sphere.radius - distance;
  if (penetration <= 0) return null;
  const normal = distance > EPSILON ? scale(delta,1/distance) : { x: 1, y: 0, z: 0 };
  return { colliderId: collider.id, normal, penetration };
}

function collideCapsuleBox(
  position: Vec3, capsule: CharacterCapsule, collider: Extract<EnvironmentCollider,{kind:'box'}>
): CharacterPhysicsContact | null {
  const { min, max } = collider.bounds, segment = capsuleSegment(position,capsule);
  const x = clamp(position.x,min.x,max.x), z = clamp(position.z,min.z,max.z);
  const y = segment.top < min.y ? segment.top : segment.bottom > max.y ? segment.bottom : clamp((Math.max(segment.bottom,min.y)+Math.min(segment.top,max.y))/2,min.y,max.y);
  const delta = { x: position.x-x, y: y-clamp(y,min.y,max.y), z: position.z-z };
  const distance = length(delta);
  if (distance > EPSILON) {
    const penetration = capsule.radius-distance;
    return penetration > 0 ? { colliderId: collider.id, normal: scale(delta,1/distance), penetration } : null;
  }

  // The capsule axis intersects the box: choose the shallowest separating face.
  const candidates = [
    { distance: Math.abs(position.x-min.x)+capsule.radius, normal: { x: -1, y: 0, z: 0 } },
    { distance: Math.abs(max.x-position.x)+capsule.radius, normal: { x: 1, y: 0, z: 0 } },
    { distance: Math.abs(position.z-min.z)+capsule.radius, normal: { x: 0, y: 0, z: -1 } },
    { distance: Math.abs(max.z-position.z)+capsule.radius, normal: { x: 0, y: 0, z: 1 } },
  ];
  if (segment.top > max.y) candidates.push({ distance: segment.top-max.y, normal: { x: 0, y: 1, z: 0 } });
  if (segment.bottom < min.y) candidates.push({ distance: min.y-segment.bottom, normal: { x: 0, y: -1, z: 0 } });
  candidates.sort((a,b)=>a.distance-b.distance);
  return { colliderId: collider.id, normal: candidates[0].normal, penetration: candidates[0].distance };
}

function applyContactResponse(
  state: CharacterPhysicsState, contact: CharacterPhysicsContact,
  collider: EnvironmentCollider, options: CharacterPhysicsOptions,
): CharacterPhysicsState {
  const position = add(state.position,scale(contact.normal,contact.penetration+1e-5));
  const normalSpeed = dot(state.velocity,contact.normal);
  let velocity = { ...state.velocity };
  if (normalSpeed < 0) {
    const restitution = collider.restitution ?? options.restitution ?? 0;
    velocity = sub(velocity,scale(contact.normal,(1+restitution)*normalSpeed));
  }
  const normalVelocity = scale(contact.normal,dot(velocity,contact.normal));
  const tangentVelocity = sub(velocity,normalVelocity);
  const friction = clamp(collider.friction ?? options.friction ?? 0.15,0,1);
  velocity = sub(velocity,scale(tangentVelocity,friction));
  return { ...state, position, velocity };
}

/**
 * Advances one character capsule through gravity and static environment colliders.
 * This is a lightweight kinematic contact solver, not a full rigid-body engine.
 */
export function stepCharacterPhysics(
  previous: CharacterPhysicsState,
  capsule: CharacterCapsule,
  colliders: EnvironmentCollider[],
  frame: number,
  fps: number,
  options: CharacterPhysicsOptions = {},
): CharacterPhysicsStep {
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0 || frame < previous.changedAtFrame) {
    throw new Error('Physics frames must be finite, non-decreasing and use a positive frame rate.');
  }
  if (!finiteVec(previous.position) || !finiteVec(previous.velocity)) throw new Error('Character physics state contains non-finite values.');
  capsuleSegment(previous.position,capsule);
  colliders.forEach(validateCollider);
  const deltaFrames = frame-previous.changedAtFrame;
  const totalDt = deltaFrames/fps;
  const maxSubstep = clamp(options.maxSubstepSec ?? 1/60,1/240,1/15);
  const substeps = Math.max(1,Math.ceil(totalDt/maxSubstep));
  const dt = substeps ? totalDt/substeps : 0;
  const gravity = Math.max(0,options.gravity ?? 9.81);
  const groundY = options.groundY ?? 0;
  const damping = clamp(options.linearDamping ?? 0.02,0,1);
  const iterations = Math.max(1,Math.min(8,Math.floor(options.solverIterations ?? 3)));
  let state: CharacterPhysicsState = { ...previous, position: { ...previous.position }, velocity: { ...previous.velocity }, grounded: false, changedAtFrame: frame };
  const contactMap = new Map<string,CharacterPhysicsContact>();

  for (let step=0; step<substeps; step++) {
    state.velocity.y -= gravity*dt;
    state.position = add(state.position,scale(state.velocity,dt));
    const groundPenetration = groundY-state.position.y;
    if (groundPenetration > 0) {
      state.position.y = groundY;
      if (state.velocity.y < 0) state.velocity.y = -state.velocity.y*(options.restitution ?? 0);
      state.grounded = true;
      const horizontalDamping = clamp(options.friction ?? 0.18,0,1);
      state.velocity.x *= 1-horizontalDamping;
      state.velocity.z *= 1-horizontalDamping;
    }
    for (let pass=0; pass<iterations; pass++) {
      let resolved = false;
      for (const collider of colliders) {
        const contact = collider.kind === 'box'
          ? collideCapsuleBox(state.position,capsule,collider)
          : collideCapsuleSphere(state.position,capsule,collider);
        if (!contact) continue;
        contactMap.set(collider.id,contact);
        state = applyContactResponse(state,contact,collider,options);
        if (contact.normal.y > 0.45) state.grounded = true;
        resolved = true;
      }
      if (!resolved) break;
    }
    const keep = Math.pow(1-damping,dt);
    state.velocity.x *= keep; state.velocity.z *= keep;
  }
  return { state, contacts: [...contactMap.values()], grounded: state.grounded, appliedGravity: gravity };
}

/** Applies the physics root transform to a Three.js character object. */
export function applyCharacterPhysicsTransform(object: Object3D, state: CharacterPhysicsState): void {
  if (object.name && object.name !== state.characterId && object.userData?.characterId !== state.characterId) {
    throw new Error('Three.js character object does not match the physics state id.');
  }
  object.position.set(state.position.x,state.position.y,state.position.z);
  object.updateMatrixWorld(true);
}

/** Basic sphere-vs-AABB overlap test for environment/object contact queries. */
export function testSphereAabbContact(sphere: PhysicsSphere, bounds: PhysicsAabb): { hit: boolean; normal: Vec3; penetration: number } {
  if (!finiteVec(sphere.center) || !Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error('Sphere query requires a finite center and positive radius.');
  if (!finiteVec(bounds.min) || !finiteVec(bounds.max) || bounds.min.x>bounds.max.x || bounds.min.y>bounds.max.y || bounds.min.z>bounds.max.z) throw new Error('Sphere query requires valid AABB bounds.');
  const closest = { x: clamp(sphere.center.x,bounds.min.x,bounds.max.x), y: clamp(sphere.center.y,bounds.min.y,bounds.max.y), z: clamp(sphere.center.z,bounds.min.z,bounds.max.z) };
  const delta = sub(sphere.center,closest), distance = length(delta), penetration = sphere.radius-distance;
  return { hit: penetration>0, normal: distance>EPSILON?scale(delta,1/distance):{x:0,y:1,z:0}, penetration: Math.max(0,penetration) };
}
