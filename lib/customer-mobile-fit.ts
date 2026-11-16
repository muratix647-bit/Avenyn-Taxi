/** Compensate only for a phone WebView stuck in a wide desktop layout. */
export function customerMobileScale(phone:boolean,screenWidth:number,layoutWidth:number){
 if(!phone||!Number.isFinite(screenWidth)||screenWidth<240||screenWidth>600||!Number.isFinite(layoutWidth)||layoutWidth<screenWidth*1.4)return 1;
 return Math.min(4,layoutWidth/screenWidth);
}
