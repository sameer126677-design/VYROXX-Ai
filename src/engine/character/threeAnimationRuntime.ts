import type { CharacterRig, CharacterPose } from './rig';
import type { CharacterExpression, ProceduralCharacterModel } from './proceduralCharacter';
import { updateCharacterExpression, setCharacterBlink, setCharacterGaze, setCharacterViseme } from './proceduralCharacter';
import { createMotionClip, sampleMotionClip, type MotionPreset, type MotionClip } from './animation';
import { createThreeRigRuntime, updateThreeRigFromPose, type ThreeRigOptions, type ThreeRigRuntime } from './threeRig';
import { sampleLipSync, type LipSyncTrack } from './lipSync';
import { evaluateCharacterActionSequence, type CharacterActionSequence, type CharacterActionFrame } from './actionSequence';
import { setCharacterHandGesture, setCharacterGaze, setCharacterViseme } from './proceduralCharacter';

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


/** Evaluates the voice viseme track at the requested frame and updates the face. */
export function updateCharacterLipSync(model:ProceduralCharacterModel,track:LipSyncTrack,frame:number):void {
  const sample=sampleLipSync(track,frame); setCharacterViseme(model,sample.viseme,sample.strength);
}


/** Evaluates a complete action timeline and applies its body and facial performance. */
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
