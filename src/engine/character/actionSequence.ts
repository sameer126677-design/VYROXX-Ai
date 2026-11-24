import type { CharacterPose, CharacterRig } from './rig';
import { blendCharacterPoses } from './animation';
import { createMotionClip, sampleMotionClip, type MotionPreset } from './animation';

export interface CharacterActionSegment {
  id: string;
  startFrame: number;
  durationFrames: number;
  motion: MotionPreset;
  blendFrames?: number;
  amplitude?: number;
  speed?: number;
  loop?: boolean;
}
export interface CharacterActionSequence { rigId: string; segments: CharacterActionSegment[]; }
export interface CharacterActionFrame { pose: CharacterPose; segmentId: string | null; progress: number; }

/** Evaluates a frame-based action timeline, blending into each new action. */
export function evaluateCharacterActionSequence(rig:CharacterRig,sequence:CharacterActionSequence,frame:number,fps:number):CharacterActionFrame {
  if(sequence.rigId!==rig.id)throw new Error('Action sequence belongs to a different rig.');
  const segments=[...sequence.segments].filter(s=>Number.isFinite(s.startFrame)&&s.durationFrames>0).sort((a,b)=>a.startFrame-b.startFrame);
  const activeIndex=segments.findIndex(s=>frame>=s.startFrame&&frame<s.startFrame+s.durationFrames);
  if(activeIndex<0){const idle=createMotionClip(rig,'idle',fps,1);return {pose:sampleMotionClip(rig,idle,frame,fps),segmentId:null,progress:0};}
  const active=segments[activeIndex],localFrame=frame-active.startFrame;
  const clip=createMotionClip(rig,active.motion,fps,active.durationFrames/Math.max(1,fps),{amplitude:active.amplitude,speed:active.speed,loop:active.loop??false});
  const pose=sampleMotionClip(rig,clip,localFrame,fps);
  const blendFrames=Math.max(0,Math.floor(active.blendFrames??0));
  if(activeIndex>0&&blendFrames>0&&localFrame<blendFrames){
    const previous=segments[activeIndex-1],previousClip=createMotionClip(rig,previous.motion,fps,previous.durationFrames/Math.max(1,fps),{amplitude:previous.amplitude,speed:previous.speed,loop:previous.loop??false});
    const previousFrame=Math.max(0,Math.min(previous.durationFrames,previous.durationFrames-(active.startFrame-previous.startFrame)+localFrame));
    const from=sampleMotionClip(rig,previousClip,previousFrame,fps);
    return {pose:blendCharacterPoses(from,pose,Math.max(0,Math.min(1,localFrame/Math.max(1,blendFrames)))),segmentId:active.id,progress:localFrame/active.durationFrames};
  }
  return {pose,segmentId:active.id,progress:Math.max(0,Math.min(1,localFrame/active.durationFrames))};
}
