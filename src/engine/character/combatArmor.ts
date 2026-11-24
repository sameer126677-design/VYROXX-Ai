import type { CombatHitContact } from './combatHitDetection';
export interface CombatArmorProfile { id:string; regionProtection:Partial<Record<CombatHitContact['region'],number>>; durability:number; maxDurability:number; }
export interface CombatArmorResult { damage:number; absorbed:number; armor:CombatArmorProfile; broken:boolean; }
/** Reduces one hit using authored region protection and consumes durability. */
export function resolveCombatArmor(contact:CombatHitContact,armor:CombatArmorProfile):CombatArmorResult{
 if(!armor.id.trim()||![armor.durability,armor.maxDurability].every(Number.isFinite)||armor.maxDurability<=0||armor.durability<0||armor.durability>armor.maxDurability)throw new Error('Invalid armor profile.');
 const protection=armor.regionProtection[contact.region]??0;
 if(!Number.isFinite(protection)||protection<0||protection>1||!Number.isFinite(contact.damage)||contact.damage<0)throw new Error('Invalid armor protection or incoming damage.');
 const effective=armor.durability>0?protection:0;const absorbed=contact.damage*effective;const wear=Math.min(armor.durability,absorbed);const next={...armor,durability:Math.max(0,armor.durability-wear)};
 return {damage:contact.damage-absorbed,absorbed,armor:next,broken:next.durability<=0};
}
