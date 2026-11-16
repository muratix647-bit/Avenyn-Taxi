import {Capacitor,registerPlugin} from '@capacitor/core';
const microphone=registerPlugin<{requestAccess:()=>Promise<{granted:boolean}>;openSettings:()=>Promise<void>}>('AvenynMicrophone');
export function hasNativeMicrophone(){return Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('AvenynMicrophone')}
export async function requestMicrophone(){
 if(hasNativeMicrophone()){
  const result=await microphone.requestAccess();
  if(!result.granted)throw new DOMException('Mikrofonen är inte tillåten.','NotAllowedError');
 }
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('Mikrofon stöds inte i den här appversionen.');
 const stream=await navigator.mediaDevices.getUserMedia({audio:true});
 stream.getTracks().forEach(track=>track.stop());
}
export async function openMicrophoneSettings(){await microphone.openSettings()}
