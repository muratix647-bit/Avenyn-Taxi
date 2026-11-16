const fs=require('fs'),assert=require('assert/strict');
const ts=require('typescript');
const root=require('path').resolve(__dirname,'..')+'/';
let googleFailure=false,fetches=[],details=0,autocompleteRequests=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fakePlace={location:{lat:()=>57.68,lng:()=>11.93},addressComponents:[{types:['route'],longText:'Mandolingatan'},{types:['street_number'],longText:'20'}],fetchFields:async()=>{details++;await delay(10)}};
const places={AutocompleteSessionToken:class {},AutocompleteSuggestion:{fetchAutocompleteSuggestions:async request=>{autocompleteRequests.push(request);await delay(20);if(googleFailure)throw Error('denied');return {suggestions:[{placePrediction:{placeId:'test',text:'Mandolingatan 20, Göteborg',mainText:'Mandolingatan 20',secondaryText:'Göteborg',toPlace:()=>fakePlace}}]}}},Place:class {constructor(){return fakePlace}}};
const modules={};
function load(file){if(modules[file])return modules[file].exports;const module={exports:{}};modules[file]=module;const source=ts.transpileModule(fs.readFileSync(root+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',source)(name=>name==='./live-map-engine'?{googleApi:async()=>({importLibrary:async()=>places})}:load('lib/'+name.slice(2)+'.ts'),module,module.exports);return module.exports;}
global.fetch=async(url)=>{fetches.push(url);if(url==='/api/maps/config')return Response.json({browserKey:'test-key'});return Response.json([{id:'photon:test',label:'Fallback',lat:57,lng:12}]);};
(async()=>{
 const api=load('lib/address-search.ts');const search=api.createAddressSearch();
 let results=await search('Mandolingatan 20',new AbortController().signal);
 assert.equal(results[0].id,'google:test');assert.equal(details,0,'no detail calls before selection');assert.equal(fetches.length,1,'no Photon on successful Google search');
 const selected=await api.resolveAddress(results[0]);assert.equal(selected.lat,57.68);assert.equal(selected.components.houseNumber,'20');assert.equal(details,1);
 await search('Mandolingatan 21',new AbortController().signal);assert.notEqual(autocompleteRequests[0].sessionToken,autocompleteRequests[1].sessionToken,'new session after selection');
 const controller=new AbortController();let pending=search('old query',controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
 googleFailure=true;results=await search('Unknown street',new AbortController().signal);assert.equal(results[0].id,'photon:test');
 results=await search('Landvetter',new AbortController().signal);assert.equal(results[0].id,'se-got-landvetter-airport');
 console.log('PASS: Google first; details only on selection; coordinates; session reset; stale request cancellation; Photon fallback; airport identity. Mock providers, not live latency.');
})().catch(e=>{console.error(e);process.exitCode=1});
