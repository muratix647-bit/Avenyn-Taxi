export const paymentMethods = ["Kort", "Tap (Blipp)", "Swish", "PayPal", "Betallänk", "Kontant", "Faktura", "Annat"];
export const paymentLabels: Record<string,string> = {card:"Kort",swish:"Swish",paypal:"PayPal",link:"Betallänk",cash:"Kontant",invoice:"Faktura",other:"Annat",app:"Betald via appen"};
export function storedStop(row:any) {
 const b=row?.price_breakdown||{};
 return {label:String(b.stop_address||String(row?.notes||"").match(/Extra stopp:\s*([^·]+)/i)?.[1]?.trim()||""),lat:b.stop_lat??undefined,lng:b.stop_lng??undefined,id:b.stop_place_id??undefined,area:b.stop_area??undefined};
}
export function stopBreakdown(stop:any) {return {stop_address:stop?.label||null,stop_lat:stop?.lat??null,stop_lng:stop?.lng??null,stop_place_id:stop?.id??null,stop_area:stop?.area??null};}

export function normalizeStop(input:any) {if(!input||!String(input.label||"").trim())return null;return {label:String(input.label).trim().slice(0,300),lat:input.lat==null?undefined:Number(input.lat),lng:input.lng==null?undefined:Number(input.lng),id:input.id?String(input.id).slice(0,180):undefined,area:input.area?String(input.area).slice(0,120):undefined};}
export function validStop(stop:any) {return !stop||(Number.isFinite(stop.lat)&&Number.isFinite(stop.lng)&&stop.lat>=54&&stop.lat<=70&&stop.lng>=8&&stop.lng<=25);}
export function withoutStopNote(notes:any) {return String(notes||"").replace(/Extra stopp:\s*[^·]+/gi,"").replace(/\s*·\s*·\s*/g," · ").replace(/^\s*·\s*|\s*·\s*$/g,"").trim();}
