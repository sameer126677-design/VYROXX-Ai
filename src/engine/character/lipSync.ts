import type { CharacterViseme, ProceduralCharacterModel } from './proceduralCharacter';
import { setCharacterViseme } from './proceduralCharacter';

export interface LipSyncCue { frame: number; viseme: CharacterViseme; strength?: number; }
export interface LipSyncTrack { cues: LipSyncCue[]; }

/** Samples a sorted cue track and returns a stable viseme/intensity at any frame. */
export function sampleLipSync(track:LipSyncTrack,frame:number):{viseme:CharacterViseme;strength:number} {
  const cues=[...track.cues].filter(c=>Number.isFinite(c.frame)).sort((a,b)=>a.frame-b.frame);
  if(!cues.length)return {viseme:'rest',strength:1};
  let previous=cues[0],next=cues[0];
  for(const cue of cues){if(cue.frame<=frame)previous=cue;if(cue.frame>=frame){next=cue;break;}next=cue;}
  if(previous===next)return {viseme:previous.viseme,strength:Math.max(0,Math.min(1,previous.strength??1))};
  const t=Math.max(0,Math.min(1,(frame-previous.frame)/Math.max(1,next.frame-previous.frame)));
  return {viseme:t<0.5?previous.viseme:next.viseme,strength:Math.max(0,Math.min(1,(previous.strength??1)+((next.strength??1)-(previous.strength??1))*t))};
}

/** Applies a sampled lip-sync cue to the character's procedural mouth. */
export function updateCharacterLipSync(model:ProceduralCharacterModel,track:LipSyncTrack,frame:number):void {
  const sample=sampleLipSync(track,frame); setCharacterViseme(model,sample.viseme,sample.strength);
}
