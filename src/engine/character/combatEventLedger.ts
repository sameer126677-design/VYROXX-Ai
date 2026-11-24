export interface CombatEventRecord { id:string; type:string; frame:number; actorId:string; targetId?:string; data?:Record<string,string|number|boolean>; }
export interface CombatEventLedger { events:CombatEventRecord[]; lastFrame:number; }
/** Creates a deterministic, append-only combat event ledger. */
export function createCombatEventLedger(frame=0):CombatEventLedger{
 if(!Number.isFinite(frame)||frame<0)throw new Error('Invalid combat ledger frame.');
 return {events:[],lastFrame:frame};
}
/** Appends an event once; duplicate ids are ignored to support safe frame re-evaluation. */
export function appendCombatEvent(previous:CombatEventLedger,event:CombatEventRecord):CombatEventLedger{
 if(!event.id.trim()||!event.type.trim()||!event.actorId.trim()||!Number.isFinite(event.frame)||event.frame<previous.lastFrame)throw new Error('Invalid or out-of-order combat event.');
 if(previous.events.some(e=>e.id===event.id))return previous;
 return {events:[...previous.events,{...event,data:event.data?{...event.data}:undefined}],lastFrame:event.frame};
}
/** Returns a read-only chronological slice suitable for UI timelines or replay export. */
export function readCombatEvents(ledger:CombatEventLedger,fromFrame=0,toFrame=Infinity):CombatEventRecord[]{
 if(!Number.isFinite(fromFrame)||fromFrame<0||Number.isNaN(toFrame)||toFrame<fromFrame)throw new Error('Invalid combat event range.');
 return ledger.events.filter(e=>e.frame>=fromFrame&&e.frame<=toFrame).map(e=>({...e,data:e.data?{...e.data}:undefined}));
}
