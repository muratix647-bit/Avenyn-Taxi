const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = {exports:{}}; cache.set(filename,module);
  const code = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const localRequire = name => {
    if(name.startsWith('@/')) return load(name.slice(2)+'.ts');
    if(name.startsWith('.')) return load(path.relative(root,path.resolve(path.dirname(filename),name))+'.ts');
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(localRequire,module,module.exports);
  return module.exports;
}
(async()=>{
 const routing=load('lib/seo-routing.ts');
 const pages=load('lib/seo-pages.ts').seoPages;
 assert.equal(new Set(pages.map(p=>p.slug)).size,pages.length,'SEO slugs must be unique');
 for(const page of pages) assert.equal(routing.legacySeoTarget(page.slug),'/'+page.slug);
 for(const [alias,target] of Object.entries(routing.seoAliases)) {
  assert(pages.some(p=>p.slug===target),`Missing target: ${alias}`);
  assert.equal(routing.legacySeoTarget(alias),'/'+target);
 }
 assert.equal(routing.landvetterAreaTarget('goteborg'),'/taxi-landvetter');
 assert.equal(routing.landvetterAreaTarget('boras'),'/taxi-boras');
 assert.equal(routing.landvetterAreaTarget('kungsbacka'),'/taxi-goteborg-kungsbacka');
 assert.equal(routing.legacySeoTarget('[slug]'),null);
 assert.equal(routing.landvetterAreaTarget('missing-area'),null);
 const routes=[['app/taxi/[legacy]/route.ts',{legacy:'taxi-goteborg'},'/taxi-goteborg'],['app/taxi-landvetter/[ort]/route.ts',{ort:'boras'},'/taxi-boras']];
 for(const [file,params,target] of routes){
  const response=await load(file).GET(new Request('https://avenyntaxi.se/old?pickup=Test'),{params:Promise.resolve(params)});
  assert.equal(response.status,301);
  assert.equal(response.headers.get('location'),routing.SEO_ORIGIN+target+'?pickup=Test');
 }
 const unknown=await load('app/taxi/[legacy]/route.ts').GET(new Request(routing.SEO_ORIGIN),{params:Promise.resolve({legacy:'unknown'})});
 assert.equal(unknown.status,404);
 const sitemap=load('app/sitemap.ts').default();
 assert.equal(sitemap.length,new Set(sitemap.map(p=>p.url)).size);
 assert.deepEqual(sitemap.map(p=>new URL(p.url).pathname).sort(),[...routing.publicSeoPaths].sort());
 for(const page of sitemap){assert.equal(new URL(page.url).origin,routing.SEO_ORIGIN);assert(!page.url.includes('?'));assert(!page.url.includes('/taxi/'));}
 const redirects=await load('next.config.ts').default.redirects();
 for(const rule of redirects){assert.equal(rule.statusCode,301);assert(rule.destination.startsWith(routing.SEO_ORIGIN));}
 assert(redirects.some(r=>r.source==='/' && r.has?.[0].value==='avenyntaxi.se'));
 assert(!redirects.some(r=>r.has?.[0].value==='avenyntaxi.se' && r.source==='/:path*'),'Do not redirect app/API sessions');
 for(const legal of ['integritet','bokningsvillkor']) assert(fs.readFileSync(path.join(root,'app',legal,'page.tsx'),'utf8').includes(`canonical: "${routing.SEO_ORIGIN}/${legal}"`));
 for(const privatePath of ['bokning','r']) assert(fs.readFileSync(path.join(root,'app',privatePath,'layout.tsx'),'utf8').includes('index:false'));
 console.log(`Passed: ${pages.length} SEO pages, ${sitemap.length} sitemap URLs, ${redirects.length} redirect rules, legacy handlers, canonical metadata and private booking noindex.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports = {load};
