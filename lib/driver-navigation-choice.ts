import {journeyStarted} from './driver-journey';
export type NavigationPhase='pickup'|'destination';
export type NavigationChoice={tripId:string;phase:NavigationPhase;open:boolean};
export function selectedNavigationPhase(trip:any,choice:NavigationChoice|null):NavigationPhase|null {
 if(!trip||!['accepted','en_route','arrived','passenger_onboard'].includes(trip.status))return null;
 if(choice?.open===false)return null;
 if(choice?.tripId===trip.id)return choice.open?choice.phase:null;
 return journeyStarted(trip)?trip.status==='passenger_onboard'?'destination':'pickup':null;
}
