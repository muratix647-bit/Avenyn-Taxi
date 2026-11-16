export const DRIVER_ALARM_VOLUME_KEY='avenyn-driver-alarm-volume';
export function alarmVolume(raw:string|null):number{if(raw===null)return 70;const n=Number(raw);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):70;}
