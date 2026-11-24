import type { CharacterPose, CharacterRig, JointPose } from './rig';
import { validateCharacterRig } from './rig';

export type MotionPreset = 'idle' | 'walk' | 'run' | 'sprint' | 'jump' | 'look-around' | 'wave' | 'talk' | 'point' | 'celebrate' | 'crouch';
export interface MotionClip {
  id: string;
  rigId: string;
  preset: MotionPreset;
  durationFrames: number;
  loop: boolean;
  amplitude: number;
  speed: number;
}
function pose(jointId: string, x = 0, y = 0, z = 0): JointPose {
  return { jointId, rotation: { x, y, z } };
}

/** Procedural keyframe-free motion sampler; deterministic at any frame. */
export function sampleMotionClip(rig: CharacterRig, clip: MotionClip, frame: number, fps: number, phaseOverride?: number): CharacterPose {
  const validation = validateCharacterRig(rig);
  if (!validation.valid) throw new Error(`Invalid rig: ${validation.errors.join(' ')}`);
  if (clip.rigId !== rig.id) throw new Error('Motion clip belongs to a different rig.');
  const duration = Math.max(1, clip.durationFrames);
  const sampleFrame = clip.loop ? ((frame % duration) + duration) % duration : Math.max(0, Math.min(duration, frame));
  const phase = Number.isFinite(phaseOverride) ? phaseOverride! : (sampleFrame / Math.max(1, duration)) * Math.PI * 2 * Math.max(0.1, clip.speed);
  const swing = Math.sin(phase) * clip.amplitude;
  const bob = Math.abs(Math.sin(phase * 2)) * clip.amplitude * 0.16;
  let joints: JointPose[] = [];
  switch (clip.preset) {
    case 'walk':
    case 'run':
    case 'sprint': {
      const factor = clip.preset === 'walk' ? 0.55 : clip.preset === 'sprint' ? 1.35 : 1;
      joints = [
        pose('left_hip', swing * factor), pose('right_hip', -swing * factor),
        pose('left_knee', Math.max(0, -swing) * factor * 0.8),
        pose('right_knee', Math.max(0, swing) * factor * 0.8),
        pose('left_shoulder', -swing * factor * 0.7),
        pose('right_shoulder', swing * factor * 0.7),
        pose('left_elbow', -0.12 * factor), pose('right_elbow', -0.12 * factor),
        pose('left_wrist', 0, 0, Math.sin(phase + Math.PI) * 0.08), pose('right_wrist', 0, 0, Math.sin(phase) * 0.08),
        pose('spine', 0, 0, bob),
      ];
      break;
    }
    case 'jump':
      joints = [pose('left_hip', -0.45), pose('right_hip', -0.45), pose('left_knee', 0.8), pose('right_knee', 0.8), pose('left_shoulder', -0.8), pose('right_shoulder', -0.8), pose('left_wrist', 0, 0, -0.12), pose('right_wrist', 0, 0, 0.12), pose('spine', 0, 0, bob)];
      break;
    case 'wave': { const wave=Math.sin(phase*2.5); joints=[pose('right_shoulder',-0.9),pose('right_elbow',-0.95+Math.abs(wave)*0.35),pose('right_wrist',0,0,wave*0.55),pose('left_shoulder',0.12),pose('spine',0,0,Math.sin(phase)*0.025)]; break; }
    case 'talk': { const beat=Math.sin(phase*3); joints=[pose('left_shoulder',-0.18+beat*0.12),pose('right_shoulder',-0.22-beat*0.16),pose('left_elbow',-0.35),pose('right_elbow',-0.42+Math.max(0,beat)*0.28),pose('left_wrist',0,0,beat*0.12),pose('right_wrist',0,0,-beat*0.18),pose('head',0,Math.sin(phase*1.5)*0.08),pose('spine',0,0,Math.sin(phase*3)*0.025)]; break; }
    case 'point': joints=[pose('right_shoulder',-0.95),pose('right_elbow',-0.12),pose('right_wrist',0,0,-0.08),pose('left_shoulder',0.08),pose('head',0,-0.12)]; break;
    case 'celebrate': { const pulse=Math.max(0,Math.sin(phase*2)); joints=[pose('left_shoulder',-1.25),pose('right_shoulder',-1.25),pose('left_elbow',-0.25),pose('right_elbow',0.25),pose('left_wrist',0,0,-0.18),pose('right_wrist',0,0,0.18),pose('left_hip',-pulse*0.12),pose('right_hip',pulse*0.12),pose('spine',0,0,pulse*0.08)]; break; }
    case 'crouch': joints=[pose('left_hip',-0.75),pose('right_hip',-0.75),pose('left_knee',1.15),pose('right_knee',1.15),pose('spine',0,0,-0.12),pose('left_shoulder',-0.25),pose('right_shoulder',-0.25)]; break;
    case 'look-around':
      joints = [pose('head', 0, Math.sin(phase) * 0.5), pose('neck', 0, Math.sin(phase) * 0.18)];
      break;
    default:
      joints = [pose('spine', 0, 0, bob * 0.35), pose('head', Math.sin(phase) * 0.025)];
  }
  if (clip.preset === 'walk' || clip.preset === 'run' || clip.preset === 'sprint') {
    const stride = clip.preset === 'walk' ? 1 : clip.preset === 'sprint' ? 1.28 : 1.12;
    const cycle = phase % (Math.PI * 2);
    const leftPhase = cycle;
    const rightPhase = (cycle + Math.PI) % (Math.PI * 2);
    const stance = (value:number) => value < Math.PI * 0.62;
    const footRoll = (value:number) => stance(value)
      ? Math.sin(value / (Math.PI * 0.62) * Math.PI) * 0.16 * stride
      : -Math.sin((value - Math.PI * 0.62) / (Math.PI * 1.38) * Math.PI) * 0.10 * stride;
    const byId = new Map(joints.map(item => [item.jointId,item]));
    const setJoint = (id:string,x:number,y:number,z:number) => {
      const current=byId.get(id);
      if(current) current.rotation={x,y,z};
      else { const item=pose(id,x,y,z); joints.push(item); byId.set(id,item); }
    };
    setJoint('left_ankle',0,0,footRoll(leftPhase));
    setJoint('right_ankle',0,0,footRoll(rightPhase));
    const head=byId.get('head');
    const spine=byId.get('spine');
    if(head) head.rotation={...head.rotation,x:head.rotation.x*0.35,y:head.rotation.y*0.45,z:head.rotation.z*0.25};
    else setJoint('head',0,0,0);
    if(spine) spine.rotation={...spine.rotation,x:spine.rotation.x*0.35,y:spine.rotation.y*0.25,z:spine.rotation.z + Math.sin(cycle*2)*0.012*stride};
    const contactLift=(value:number)=>stance(value)?0:Math.sin((value-Math.PI*.62)/(Math.PI*1.38)*Math.PI)*0.035*stride;
    setJoint('left_knee',byId.get('left_knee')?.rotation.x??0,0,0);
    setJoint('right_knee',byId.get('right_knee')?.rotation.x??0,0,0);
    const leftAnkle=byId.get('left_ankle'),rightAnkle=byId.get('right_ankle');
    const leftBind=rig.joints.find(item=>item.id==='left_ankle')?.bindPosition;
    const rightBind=rig.joints.find(item=>item.id==='right_ankle')?.bindPosition;
    if(leftAnkle&&leftBind) leftAnkle.position={x:leftBind.x,y:leftBind.y+contactLift(leftPhase),z:leftBind.z};
    if(rightAnkle&&rightBind) rightAnkle.position={x:rightBind.x,y:rightBind.y+contactLift(rightPhase),z:rightBind.z};
  }
  return { rigId: rig.id, frame, joints };
}


/** Smoothly blends two poses from the same rig; missing joints retain the available side. */
export function blendCharacterPoses(from: CharacterPose, to: CharacterPose, amount: number): CharacterPose {
  if (from.rigId !== to.rigId) throw new Error('Cannot blend poses from different rigs.');
  const t = Math.max(0, Math.min(1, amount));
  const fromJoints = new Map(from.joints.map((joint) => [joint.jointId, joint]));
  const toJoints = new Map(to.joints.map((joint) => [joint.jointId, joint]));
  const ids = new Set([...fromJoints.keys(), ...toJoints.keys()]);
  const joints: JointPose[] = [...ids].map((jointId) => {
    const a = fromJoints.get(jointId), b = toJoints.get(jointId);
    if (!a) return { ...b!, rotation: { ...b!.rotation }, position: b!.position ? { ...b!.position } : undefined };
    if (!b) return { ...a, rotation: { ...a.rotation }, position: a.position ? { ...a.position } : undefined };
    const lerp = (x: number, y: number) => x + (y - x) * t;
    const rotation = { x: lerp(a.rotation.x, b.rotation.x), y: lerp(a.rotation.y, b.rotation.y), z: lerp(a.rotation.z, b.rotation.z) };
    const position = a.position && b.position ? { x: lerp(a.position.x,b.position.x), y: lerp(a.position.y,b.position.y), z: lerp(a.position.z,b.position.z) } : (t < 0.5 ? a.position : b.position);
    return { jointId, rotation, position: position ? { ...position } : undefined };
  });
  return { rigId: from.rigId, frame: Math.round(from.frame + (to.frame - from.frame) * t), joints };
}

export function createMotionClip(rig: CharacterRig, preset: MotionPreset, fps: number, durationSec: number, options: Partial<Pick<MotionClip, 'amplitude' | 'speed' | 'loop'>> = {}): MotionClip {
  return {
    id: `motion-${rig.characterId}-${preset}`,
    rigId: rig.id,
    preset,
    durationFrames: Math.max(1, Math.round(fps * durationSec)),
    loop: options.loop ?? ['idle', 'walk', 'run', 'sprint', 'talk', 'wave', 'celebrate'].includes(preset),
    amplitude: options.amplitude ?? (preset === 'walk' ? 0.55 : preset === 'idle' ? 0.12 : 0.9),
    speed: options.speed ?? (preset === 'walk' ? 1.5 : preset === 'idle' ? 0.5 : 2.4),
  };
}
