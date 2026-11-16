export type PetSelection={id:string;label:string;count:number}|null;
export function normalizePet(value:any):PetSelection {
 if(value==null||value.id==='')return null;
 if(typeof value.id!=='string'||!/^[a-z0-9_-]{1,60}$/.test(value.id)||!Number.isInteger(Number(value.count))||Number(value.count)<1||Number(value.count)>5)throw new Error('Välj djur och ett antal mellan 1 och 5.');
 return {id:value.id,label:String(value.label||'').trim().slice(0,80),count:Number(value.count)};
}
export async function validatePet(db:any,value:any,previous?:any):Promise<PetSelection>{
 const pet=normalizePet(value);if(!pet)return null;
 const {data,error}=await db.from('pet_options').select('id,label,archived_at').eq('id',pet.id).maybeSingle();
 if(error)throw error;if(!data||data.archived_at){if(previous?.id===pet.id)return {...pet,label:previous.label};throw new Error('Djurvalet är inte tillgängligt. Välj ett annat.');}
 return {...pet,label:data.label};
}
export function petText(pet:any){return pet?.id?`${pet.label||'Djur'} · ${pet.count||1}`:'';}
