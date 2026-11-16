export const activeVoiceStatuses = new Set(["assigned", "accepted", "en_route", "arrived", "passenger_onboard"]);
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function voiceIdentity(booking: string, driver: string, role: "customer" | "driver") {
  if (!uuid.test(booking) || !uuid.test(driver)) throw new Error("invalid_identity");
  return `trip_${booking.replaceAll("-", "")}_${driver.replaceAll("-", "")}_${role}`;
}
export function parseVoiceIdentity(value: string) {
  const match = /^client:trip_([0-9a-f]{32})_([0-9a-f]{32})_(customer|driver)$/i.exec(value);
  if (!match) return null;
  const expand = (s: string) => `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
  return { bookingId: expand(match[1]), driverId: expand(match[2]), role: match[3] as "customer" | "driver" };
}
export async function hmac(secret: string, value: string, algorithm = "SHA-256") {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:algorithm }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
export const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const url64 = (bytes: Uint8Array) => base64(bytes).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
export async function voiceJwt(account: string, key: string, secret: string, app: string, identity: string) {
  const now = Math.floor(Date.now()/1000);
  const encode = (value: unknown) => url64(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({typ:"JWT",alg:"HS256",cty:"twilio-fpa;v=1"})}.${encode({jti:`${key}-${crypto.randomUUID()}`,iss:key,sub:account,iat:now,exp:now+600,grants:{identity,voice:{incoming:{allow:true},outgoing:{application_sid:app}}}})}`;
  return `${unsigned}.${url64(await hmac(secret,unsigned))}`;
}
export async function validTwilioSignature(secret:string, url:string, params:URLSearchParams, signature:string) {
  if (!signature || !secret) return false;
  // Reject duplicate fields instead of accepting ambiguous request data.
  const keys = [...params.keys()]; if (new Set(keys).size !== keys.length) return false;
  const message = url + keys.sort().map(key=>key+params.get(key)).join("");
  const expected = base64(await hmac(secret,message,"SHA-1"));
  if (expected.length !== signature.length) return false;
  let difference=0; for(let i=0;i<expected.length;i++) difference |= expected.charCodeAt(i)^signature.charCodeAt(i);
  return difference===0;
}
