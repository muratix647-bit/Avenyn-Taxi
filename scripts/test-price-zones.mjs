import assert from 'node:assert/strict';
import fs from 'node:fs';
import {identifyZone,matchTrustedArea,boundaryContains} from '../lib/geo-zones.ts';
import {areaHierarchyFromResults} from '../lib/reverse-area.ts';
const zones=JSON.parse(fs.readFileSync(new URL('./price-zone-catalog.fixture.json',import.meta.url),'utf8'));
for(const z of zones){
 const lat=z.lat??57.7,lng=z.lng??12;
 if(z.boundary)assert.ok(boundaryContains(z.boundary,lat,lng),z.code);
 if(z.code==='centralen')assert.equal(identifyZone(zones,57.7089,11.9733,['Göteborg Centralstation'])?.code,z.code);
 else assert.equal(matchTrustedArea(zones,lat,lng,[z.name])?.code,z.code);
 assert.ok(Number(z.fixed_price)>0,z.code);
}
const classify=(lat,lng,address,photon=null)=>{
 const h=areaHierarchyFromResults(photon,{address},{address:{municipality:'Mölndals kommun'}});
 return (identifyZone(zones,lat,lng,h.values)??matchTrustedArea(zones,lat,lng,h.values))?.code;
};
assert.equal(classify(57.5645236,11.9898054,{road:'Tråkärrsslättvägen',hamlet:'Hällesås',city_district:'Sydväst',municipality:'Mölndals kommun',postcode:'427 50'}),'billdal');
assert.equal(classify(57.5645236,11.9898054,{road:'Spårhagavägen',municipality:'Mölndals kommun',postcode:'42750'}),'billdal');
assert.equal(classify(57.5693548,12.0360765,{road:'Spårhagavägen',neighbourhood:'Björnarås',hamlet:'Långås',town:'Lindome',municipality:'Mölndals kommun',postcode:'437 41'}),'lindome');
assert.equal(classify(57.5645236,11.9898054,{municipality:'Mölndals kommun'}),undefined);
const h=areaHierarchyFromResults({features:[{properties:{street:'Spårhagavägen',city:'Mölndals kommun',postcode:'427 50',state:'Västra Götalands län'}}]},null,null);
assert.deepEqual(h.values,['Billdal']);
assert.deepEqual(areaHierarchyFromResults(null,null,null).values,[]);
assert.ok(areaHierarchyFromResults(null,{address:{city:'Kållered'}},null).values.includes('Kållered'));
console.log(`PASS: ${zones.length} zone names/fares, ${zones.filter(z=>z.boundary).length} PostGIS boundaries; Billdal/Lindome street split, postal fallback, municipality exclusion, city field, provider failure.`);
