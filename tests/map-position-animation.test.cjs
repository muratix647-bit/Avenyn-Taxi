const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/map-position-animation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,Math});
const {interpolatePosition}=m.exports;const a={lat:57.7,lng:11.9},b={lat:57.702,lng:11.904};
assert.equal(interpolatePosition(a,b,.5).lat,57.701);
assert.equal(interpolatePosition(a,b,-1).lat,a.lat);
assert.equal(interpolatePosition(a,b,2).lng,b.lng);
assert.equal(interpolatePosition(a,{lat:58,lng:12},.1).lat,58);
console.log('Map animation: measured midpoint, bounded endpoints and GPS correction snap passed');

assert.equal(m.exports.animationDuration(500),500);assert.equal(m.exports.animationDuration(10),250);assert.equal(m.exports.animationDuration(10000),1500);assert.equal(m.exports.animationDuration(NaN),850);
const {travelBearing,interpolateBearing}=m.exports;
assert.equal(travelBearing(a,a),null);
assert.equal(travelBearing(a,{lat:a.lat+0.000001,lng:a.lng}),null);
assert.ok(Math.abs(travelBearing(a,{lat:a.lat+.001,lng:a.lng}))<.01);
assert.ok(Math.abs(travelBearing(a,{lat:a.lat,lng:a.lng+.001})-90)<.01);
assert.equal(interpolateBearing(359,1,.5),0);
assert.equal(interpolateBearing(1,359,.5),0);
console.log('Travel heading: stationary jitter, north/east and shortest turn across north passed');
