import type { Vec3 } from '../core/types';
import type { GroundContactSurface, GroundObstacleSample } from './groundContact';
export interface CharacterTerrainProbe { height:number; normal:Vec3; slopeRadians:number; obstacle:GroundObstacleSample|null; walkable:boolean; }
export interface CharacterTerrainProbeOptions { maxSlopeRadians?:number; obstacleRadius?:number; }
export function probeCharacterTerrain(surface:GroundContactSurface,x:number,z:number,options:CharacterTerrainProbeOptions={}):CharacterTerrainProbe {
 if(![x,z,options.maxSlopeRadians??0.78,options.obstacleRadius??0.07].every(Number.isFinite)|| (options.obstacleRadius??0.07)<0) throw new Error('Invalid terrain probe input.');
 const height=surface.heightAt(x,z);
 if(!Number.isFinite(height)) throw new Error('Terrain height must be finite.');
 const raw=surface.normalAt?.(x,z)??{x:0,y:1,z:0},length=Math.hypot(raw.x,raw.y,raw.z);
 if(![raw.x,raw.y,raw.z].every(Number.isFinite)||length<1e-8) throw new Error('Terrain normal must be finite and non-zero.');
 const normal={x:raw.x/length,y:raw.y/length,z:raw.z/length};
 const slopeRadians=Math.acos(Math.max(-1,Math.min(1,normal.y)));
 const obstacle=surface.obstacleAt?.(x,z,options.obstacleRadius??0.07)??null;
 if(obstacle&&(!Number.isFinite(obstacle.height)||!Number.isFinite(obstacle.clearance??0))) throw new Error('Terrain obstacle sample must be finite.');
 return {height,normal,slopeRadians,obstacle,walkable:slopeRadians<=(options.maxSlopeRadians??0.78)};
}
