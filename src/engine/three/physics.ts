import { PhysicsSpec, Vector3Spec } from '../../shared/sceneSchema';

export interface EvaluatedPhysicsState {
  x: number;
  y: number;
  z: number;
  vy: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotX: number;
  rotZ: number;
  bounces: number;
}

/**
 * Deterministic analytical / fixed-step physics solver evaluated purely as a
 * function of `tSec`, so timeline scrubbing and video frame export are 100%
 * reproducible regardless of display FPS.
 */
export function evaluatePhysicsState(
  spec: PhysicsSpec,
  basePos: Vector3Spec,
  tSec: number
): EvaluatedPhysicsState {
  const t = Math.max(0, Math.min(tSec, 120));
  const g = Math.max(0.1, Math.abs(spec.gravity ?? 9.81));
  const vx = spec.initialVelocity?.x ?? 0;
  const vz = spec.initialVelocity?.z ?? 0;
  const restitution = Math.max(0, Math.min(0.98, spec.restitution ?? 0.78));
  const damping = Math.max(0, spec.damping ?? 0.35);
  const groundY = spec.groundY ?? 0;
  const doSquash = spec.squashStretch !== false;

  const state: EvaluatedPhysicsState = {
    x: basePos.x,
    y: basePos.y,
    z: basePos.z,
    vy: spec.initialVelocity?.y ?? 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    rotX: 0,
    rotZ: 0,
    bounces: 0,
  };

  if (spec.mode === 'none') {
    return state;
  }

  if (spec.mode === 'bounce' || spec.mode === 'projectile') {
    // If resting on ground with zero upward velocity in bounce mode, give a clean launch impulse
    let y = Math.max(groundY, basePos.y);
    let vy = spec.initialVelocity?.y ?? (y <= groundY + 0.05 ? 8.5 : 0);

    const stepDt = 1 / 120;
    const totalSteps = Math.round(t / stepDt);
    let timeSinceBounce = 99;
    let impactSpeed = 0;

    for (let i = 0; i < totalSteps; i++) {
      vy -= g * stepDt;
      if (damping > 0) {
        vy *= Math.max(0, 1 - damping * 0.08 * stepDt);
      }
      y += vy * stepDt;

      if (y <= groundY) {
        y = groundY;
        if (vy < -0.18) {
          impactSpeed = Math.abs(vy);
          vy = spec.mode === 'bounce' ? impactSpeed * restitution : 0;
          state.bounces++;
          timeSinceBounce = 0;
        } else {
          vy = 0;
        }
      } else {
        timeSinceBounce += stepDt;
      }
    }

    // Sub-step remainder for smooth sub-frame interpolation
    const rem = t - totalSteps * stepDt;
    if (rem > 0) {
      vy -= g * rem;
      y = Math.max(groundY, y + vy * rem);
    }

    state.x = basePos.x + vx * t;
    state.y = y;
    state.z = basePos.z + vz * t;
    state.vy = vy;

    if (doSquash && timeSinceBounce < 0.14 && impactSpeed > 0.4) {
      const squashAmt =
        Math.min(0.32, impactSpeed * 0.026) * Math.cos((timeSinceBounce / 0.14) * (Math.PI * 0.5));
      state.scaleY = Math.max(0.68, 1 - squashAmt);
      const invSqrt = 1 / Math.sqrt(state.scaleY);
      state.scaleX = invSqrt;
      state.scaleZ = invSqrt;
    } else if (doSquash && Math.abs(vy) > 4.5) {
      const stretch = Math.min(0.14, (Math.abs(vy) - 4.5) * 0.014);
      state.scaleY = 1 + stretch;
      const invSqrt = 1 / Math.sqrt(state.scaleY);
      state.scaleX = invSqrt;
      state.scaleZ = invSqrt;
    }
    return state;
  }

  if (spec.mode === 'spring') {
    const k = Math.max(0.5, spec.springK ?? 12);
    const omega = Math.sqrt(k);
    const amp = spec.amplitude ?? 2.5;
    const envelope = Math.exp(-damping * t);
    const disp = amp * envelope * Math.cos(omega * t);
    state.y = Math.max(groundY, basePos.y + amp * 0.5 + disp * 0.5);
    state.vy =
      -amp * 0.5 * envelope * (damping * Math.cos(omega * t) + omega * Math.sin(omega * t));
    if (doSquash) {
      const s = 1 - Math.max(-0.18, Math.min(0.18, disp * 0.05));
      state.scaleY = s;
      const inv = 1 / Math.sqrt(s);
      state.scaleX = inv;
      state.scaleZ = inv;
    }
    return state;
  }

  if (spec.mode === 'pendulum') {
    const length = Math.max(0.6, spec.amplitude ?? 3.2);
    const omega = Math.sqrt(Math.max(0.5, g) / length);
    const maxAngle = 0.72;
    const envelope = Math.exp(-damping * 0.25 * t);
    const angle = maxAngle * envelope * Math.sin(omega * t);
    state.x = basePos.x + Math.sin(angle) * length * 0.65;
    state.y = Math.max(groundY, basePos.y + (1 - Math.cos(angle)) * length * 0.55);
    state.rotZ = -angle;
    return state;
  }

  if (spec.mode === 'buoyancy') {
    const amp = Math.min(1.5, spec.amplitude ?? 0.45);
    state.y =
      basePos.y +
      Math.sin(t * 2.1) * amp +
      Math.cos(t * 1.3 + basePos.x * 0.4) * amp * 0.4;
    state.rotX = Math.sin(t * 1.7) * 0.09;
    state.rotZ = Math.cos(t * 1.4) * 0.11;
    return state;
  }

  if (spec.mode === 'orbit-gravity') {
    const r = Math.max(1.8, Math.hypot(basePos.x, basePos.z) || spec.amplitude || 6);
    const angSpeed = Math.sqrt(Math.max(2, g * 3) / (r * r * r)) * 4.5;
    const startAng = Math.atan2(basePos.z, basePos.x);
    const ang = startAng + t * angSpeed;
    state.x = Math.cos(ang) * r;
    state.z = Math.sin(ang) * r;
    state.y = basePos.y + Math.sin(ang * 2) * 0.35;
    return state;
  }

  return state;
}
