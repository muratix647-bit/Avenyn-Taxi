import assert from 'node:assert/strict';
import test from 'node:test';
import {boundaryContains,matchZoneByPosition} from './geo-zones.ts';
function ewkb(little:boolean){
 const bytes=new Uint8Array(13+4+5*16),v=new DataView(bytes.buffer);let o=0;
 bytes[o++]=little?1:0;v.setUint32(o,0x20000003,little);o+=4;v.setUint32(o,4326,little);o+=4;
 v.setUint32(o,1,little);o+=4;v.setUint32(o,5,little);o+=4;
 for(const p of [[11,57],[12,57],[12,58],[11,58],[11,57]])for(const n of p){v.setFloat64(o,n,little);o+=8;}
 return Buffer.from(bytes).toString('hex');
}
test('PostGIS little and big endian boundaries preserve coordinates',()=>{
 for(const little of [true,false]){
  assert.equal(boundaryContains(ewkb(little),57.5,11.5),true);
  assert.equal(boundaryContains(ewkb(little),58.5,11.5),false);
  assert.equal(boundaryContains(ewkb(little).slice(0,-4),57.5,11.5),false);
 }
});
test('polygon and hole edges match ST_Covers',()=>{
 const polygon={type:'Polygon',coordinates:[[[11,57],[12,57],[12,58],[11,58],[11,57]],[[11.2,57.2],[11.8,57.2],[11.8,57.8],[11.2,57.8],[11.2,57.2]]]};
 assert.equal(boundaryContains(polygon,57,11.5),true);
 assert.equal(boundaryContains(polygon,57.2,11.5),true);
 assert.equal(boundaryContains(polygon,57.5,11.5),false);
});
test('smallest enclosing price zone wins independently of row order',()=>{
 const large={code:'large',name:'Large',aliases:[],boundary:'POLYGON((11 57,12 57,12 58,11 58,11 57))'};
 const small={code:'small',name:'Small',aliases:[],boundary:'POLYGON((11.2 57.2,11.8 57.2,11.8 57.8,11.2 57.8,11.2 57.2))'};
 for(const zones of [[large,small],[small,large]])assert.equal(matchZoneByPosition(zones,57.5,11.5)?.code,'small');
});
