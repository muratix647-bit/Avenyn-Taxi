import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { voiceIdentity, parseVoiceIdentity, voiceJwt, validTwilioSignature, activeVoiceStatuses } from './voice-security.ts';
const booking='11111111-1111-4111-8111-111111111111',driver='22222222-2222-4222-8222-222222222222';
test('identities bind role, booking and assigned driver; reject phone targets',()=>{
 const identity=voiceIdentity(booking,driver,'customer');assert.deepEqual(parseVoiceIdentity('client:'+identity),{bookingId:booking,driverId:driver,role:'customer'});
 assert.equal(parseVoiceIdentity('+46700000000'),null);assert.equal(parseVoiceIdentity('client:admin'),null);
 assert.throws(()=>voiceIdentity('<xml>',driver,'driver'));assert.ok(!activeVoiceStatuses.has('completed'));assert.ok(!activeVoiceStatuses.has('cancelled'));
});
test('short-lived JWT signed with separate API secret and no phone grant',async()=>{
 const token=await voiceJwt('ACtest','SKtest','test-secret','APtest',voiceIdentity(booking,driver,'driver'));
 const [header,payload,signature]=token.split('.');assert.equal(signature,createHmac('sha256','test-secret').update(header+'.'+payload).digest('base64url'));
 const body=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(body.exp-body.iat,600);assert.equal(body.grants.voice.outgoing.application_sid,'APtest');assert.equal(body.grants.voice.incoming.allow,true);assert.ok(!JSON.stringify(body).includes('test-secret'));
});
test('webhook validates exact URL and fields, rejects tampering/duplicates',async()=>{
 const url='https://avenyntaxi.se/api/voice/connect',params=new URLSearchParams({From:'client:test',AccountSid:'ACtest'});
 const signature=createHmac('sha1','secret').update(url+'AccountSidACtestFromclient:test').digest('base64');
 assert.equal(await validTwilioSignature('secret',url,params,signature),true);
 assert.equal(await validTwilioSignature('secret',url+'/wrong',params,signature),false);
 params.set('From','client:other');assert.equal(await validTwilioSignature('secret',url,params,signature),false);
 params.append('From','client:test');assert.equal(await validTwilioSignature('secret',url,params,signature),false);
});
