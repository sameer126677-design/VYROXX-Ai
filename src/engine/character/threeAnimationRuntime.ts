import type { CharacterRig, CharacterPose } from './rig';
import type { CharacterExpression, ProceduralCharacterModel } from './proceduralCharacter';
import { updateCharacterExpression, setCharacterBlink, setCharacterGaze, setCharacterViseme } from './proceduralCharacter';
import { createMotionClip, sampleMotionClip, type MotionPreset, type MotionClip } from './animation';
import { createThreeRigRuntime, updateThreeRigFromPose, type ThreeRigOptions, type ThreeRigRuntime } from './threeRig';

export interface ThreeCharacterFrame {
  runtime: ThreeRigRuntime;
  pose: CharacterPose;
  frame: number;
}

/** Builds a rig runtime and evaluates one deterministic animation frame. */
export function evaluateThreeCharacterFrame(
  rig: CharacterRig,
  preset: MotionPreset,
  frame: number,
  fps: number,
  options: ThreeRigOptions & { durationSec?: number; clip?: MotionClip } = {}
): ThreeCharacterFrame {
  const runtime = createThreeRigRuntime(rig, options);
  const clip = options.clip ?? createMotionClip(rig, preset, fps, options.durationSec ?? 2);
  const pose = sampleMotionClip(rig, clip, frame, fps);
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return { runtime, pose, frame };
}

/** Updates an existing runtime without rebuilding its Three.js hierarchy. */
export function updateThreeCharacterFrame(
  runtime: ThreeRigRuntime,
  rig: CharacterRig,
  preset: MotionPreset,
  frame: number,
  fps: number,
  options: { durationSec?: number; clip?: MotionClip; unitScale?: number } = {}
): CharacterPose {
  const clip = options.clip ?? createMotionClip(rig, preset, fps, options.durationSec ?? 2);
  const pose = sampleMotionClip(rig, clip, frame, fps);
  updateThreeRigFromPose(runtime, rig, pose, options.unitScale ?? 1);
  return pose;
}


export interface CharacterPerformance { motion: MotionPreset; expression?: CharacterExpression; expressionAtFrame?: number; }

/** Evaluates a reusable motion and applies its optional expression cue on an existing character. */
export function updateCharacterPerformance(model: ProceduralCharacterModel, rig: CharacterRig, performance: CharacterPerformance, frame: number, fps: number, options: { durationSec?: number; clip?: MotionClip; unitScale?: number } = {}): CharacterPose {
  const pose = updateThreeCharacterFrame(model.rig, rig, performance.motion, frame, fps, options);
  if (performance.expression && frame >= (performance.expressionAtFrame ?? 0) && model.appearance.expression !== performance.expression) updateCharacterExpression(model, performance.expression);
  return pose;
}


export interface FacialAnimationOptions { blinkIntervalSec?: number; blinkDurationSec?: number; gazeAmplitude?: number; }

/** Deterministic frame-based blink and subtle eye-gaze animation. */
export function updateCharacterFacialAnimation(model:ProceduralCharacterModel,frame:number,fps:number,options:FacialAnimationOptions={}):void {
  const safeFps=Math.max(1,fps);
  const interval=Math.max(0.5,options.blinkIntervalSec??3.6)*safeFps;
  const duration=Math.max(1,options.blinkDurationSec??0.12)*safeFps;
  const cycle=((Math.max(0,frame)%interval)+interval)%interval;
  setCharacterBlink(model,cycle<duration);
  const amplitude=Math.max(0,Math.min(0.012,options.gazeAmplitude??0.006));
  const phase=Math.max(0,frame)/safeFps;
  setCharacterGaze(model,Math.sin(phase*0.73)*amplitude,Math.sin(phase*0.41)*amplitude*0.55);
}

export interface LipSyncCue { frame: number; viseme: import('./proceduralCharacter').CharacterViseme; strength?: number; }
export interface LipSyncTrack { cues: LipSyncCue[]; }

/** Samples the nearest cue pair and interpolates mouth intensity deterministically. */
export function sampleLipSync(track:LipSyncTrack,frame:number):{viseme:import('./proceduralCharacter').CharacterViseme;strength:number} {
  const cues=[...track.cues].filter(c=>Number.isFinite(c.frame)).sort((a,b)=>a.frame-b.frame);
  if(!cues.length)return {viseme:'rest',strength:1};
  let previous=cues[0],next=cues[0];
  for(const cue of cues){if(cue.frame<=frame)previous=cue;if(cue.frame>=frame){next=cue;break;}next=cue;}
  if(previous===next)return {viseme:previous.viseme,strength:Math.max(0,Math.min(1,previous.strength??1))};
  const span=Math.max(1,next.frame-previous.frame),t=Math.max(0,Math.min(1,(frame-previous.frame)/span));
  return {viseme:t<0.5?previous.viseme:next.viseme,strength:Math.max(0,Math.min(1,(previous.strength??1)+((next.strength??1)-(previous.strength??1))*t))};
}

/** Applies a frame-sampled lip-sync track to an existing procedural character. */
export function updateCharacterLipSync(model:ProceduralCharacterModel,track:LipSyncTrack,frame:number):void {
  const sample=sampleLipSync(track,frame);
  import('./proceduralCharacter').then(()=>undefined);
  const mouth=model.rig.joints.get('head')?.getObjectByName('mouth') as import('three').Mesh | undefined;
  if(!mouth)return;
  const shapes:Record<import('./proceduralCharacter').CharacterViseme,[number,number,number]>={rest:[1,.4,.4],aa:[1.35,1.8,.7],ee:[1.55,.55,.45],oh:[.72,1.65,.8],fv:[1.25,.32,.35],mbp:[1.1,.12,.25]};
  const target=shapes[sample.viseme],s=sample.strength;
  mouth.scale.set(1+(target[0]-1)*s,.4+(target[1]-.4)*s,.4+(target[2]-.4)*s);
}
