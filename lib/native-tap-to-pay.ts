import {Capacitor,registerPlugin} from '@capacitor/core';
type TapPlugin={
 availability():Promise<{available:boolean;reason?:string}>;
 pay(options:{accessToken:string;clientSecret:string;locationId:string}):Promise<{verifyOnServer:boolean}>;
};
export const nativeTap=registerPlugin<TapPlugin>('AvenynTapToPay');
export function hasNativeTap(){return Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('AvenynTapToPay')}
