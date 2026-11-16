export type DynamicSettings={enabled:boolean;time_percent:number;demand_percent:number;max_percent:number;minimum_waiting:number};
export function dynamicPercent(settings:DynamicSettings,pickupTime:string,waiting:number,available:number,demandEligible:boolean){
 if(!settings.enabled)return {percent:0,reasons:[] as string[]};
 const match=/^(\d{4}-\d{2}-\d{2})T(\d{2}):/.exec(pickupTime);if(!match)return {percent:0,reasons:[] as string[]};
 const day=new Date(match[1]+'T12:00:00Z').getUTCDay(),hour=Number(match[2]);
 const reasons:string[]=[];let percent=0;
 if(day===0||day===6||hour>=18||hour<6){percent+=settings.time_percent;if(settings.time_percent)reasons.push('Kväll/helg');}
 if(demandEligible&&waiting>=settings.minimum_waiting&&waiting>available){percent+=settings.demand_percent;if(settings.demand_percent)reasons.push('Hög efterfrågan');}
 return {percent:Math.max(0,Math.min(settings.max_percent,percent)),reasons};
}
