/** Never cover an unaccepted offer, and don't start an idle map in a hidden tab. */
export function nativeMapMode(hasTrip:boolean,hasRoute:boolean,visible:boolean,idleSupported:boolean):'route'|'idle'|'closed'{
 if(hasRoute)return 'route';
 return !hasTrip&&visible&&idleSupported?'idle':'closed';
}
