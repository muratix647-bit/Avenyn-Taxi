const assert = require('node:assert/strict');
const {load}=require('./seo-routing.test.cjs');
const {legacyPublicResponse}=load('lib/legacy-public-urls.ts');
const {publicSeoPaths}=load('lib/seo-routing.ts');
// 48 legacy URLs; /en/services is now a real translated page.
const urls = [
'www.avenyntaxi.se/en/fleet','www.avenyntaxi.se/en?area=Agnesberg','avenyntaxi.se/pages/',
'www.avenyntaxi.se/en/taxi/foretagstaxi-goteborg','www.avenyntaxi.se/en?area=Eriksberg',
'avenyntaxi.se/taxi-frolunda:1k1k0bf','www.avenyntaxi.se/en/pricing','www.avenyntaxi.se/services','www.avenyntaxi.se/en/taxi/taxi-molndal-landvetter',
'www.avenyntaxi.se/en?area=Bifrost','www.avenyntaxi.se/en/contact','www.avenyntaxi.se/taxi/foretagstaxi-goteborg','www.avenyntaxi.se/en/taxi/taxi-landvetter',
'www.avenyntaxi.se/en/privacy','www.avenyntaxi.se/taxi/fast-pris-taxi-landvetter','www.avenyntaxi.se/en','www.avenyntaxi.se/taxi/flygtaxi-goteborg',
'www.avenyntaxi.se/pricing','www.avenyntaxi.se/en?area=Lundby','www.avenyntaxi.se/about','www.avenyntaxi.se/contact',
'www.avenyntaxi.se/en?area=Annedal','www.avenyntaxi.se/en?area=Tolered','www.avenyntaxi.se/en?area=Lillhagen','www.avenyntaxi.se/en?area=Svingeln',
'www.avenyntaxi.se/en?area=Nya%20varvet','www.avenyntaxi.se/en?area=Tagene','www.avenyntaxi.se/en?area=Backatorp','avenyntaxi.se/taxi-lerum:czkq0s',
'www.avenyntaxi.se/en?area=Lindholmen','avenyntaxi.se/taxi-vanersborg:1vvoa1k','avenyntaxi.se/taxi-goteborg-stenungsund:nyli7a',
'www.avenyntaxi.se/en?area=Eklanda','avenyntaxi.se/taxi-skovde:12nkunv','www.avenyntaxi.se/en?area=Askim','avenyntaxi.se/taxi-vanersborg:1ehtv21',
'avenyntaxi.se/home/','www.avenyntaxi.se/en?area=Tuve','www.avenyntaxi.se/fleet','avenyntaxi.se/taxi-partille:1kijl3a',
'www.avenyntaxi.se/en?area=Nol','avenyntaxi.se/taxi-kungalv:m86jrh','avenyntaxi.se/pricing','www.avenyntaxi.se/en?area=Haga',
'www.avenyntaxi.se/en?area=Utby','www.avenyntaxi.se/taxi-goteborg-smogen:1shyd22','avenyntaxi.se/cdn-cgi/l/email-protection','www.avenyntaxi.se/Muratix647@gmail.com',
];
assert.equal(urls.length,48);assert.equal(new Set(urls).size,48);
let redirects=0,gone=0;
for(const entry of urls){
 const url='https://'+entry;
 const response=legacyPublicResponse(new Request(url));
 assert(response,`Unmatched URL: ${url}`);
 if(response.status===410){gone++;assert.equal(response.headers.get('x-robots-tag'),'noindex');continue;}
 assert.equal(response.status,301,url);redirects++;
 const target=new URL(response.headers.get('location'));
 assert.equal(target.origin,'https://www.avenyntaxi.se');
 assert(publicSeoPaths.includes(target.pathname),`Missing target ${target}`);
 assert.equal(legacyPublicResponse(new Request(target)),null,'Redirect must not loop');
 const original=new URL(url);
 if(original.searchParams.has('area')){
  assert.equal(target.searchParams.get('pickup'),original.searchParams.get('area'));
  assert.equal(target.searchParams.get('lang'),'en-US');
  assert.equal(target.searchParams.has('area'),false);
 }
}
assert.equal(redirects,46);assert.equal(gone,2);
for(const path of ['/en/services','/en/services/','/api/bookings','/driver','/dispatch','/r/private-token','/en/unknown','/taxi-unknown:abc','/taxi-goteborg','/']){
 assert.equal(legacyPublicResponse(new Request('https://www.avenyntaxi.se'+path)),null,path);
}
assert.equal(legacyPublicResponse(new Request('https://www.avenyntaxi.se/en',{method:'POST'})),null);
const encoded=legacyPublicResponse(new Request('https://avenyntaxi.se/taxi-frolunda%3A1k1k0bf'));
assert.equal(encoded.headers.get('location'),'https://www.avenyntaxi.se/taxi-frolunda');
console.log('Passed: 48 legacy URLs — 46 permanent redirects and 2 removed URLs; area/language preservation, encoded suffixes, no loops and app/API exclusions.');
