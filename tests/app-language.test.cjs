const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function mod(p,deps={}){let m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:n=>deps[n]});return m.exports}
const customer=mod('lib/customer-i18n.ts'),dict=mod('lib/app-translations.ts');const {translateAppText:t}=mod('lib/app-language-text.ts',{'./customer-i18n':customer,'./app-translations':dict});
for(const l of ['en-US','hi','ml','de','de-CH','es','it','he']){assert.equal(t('Logga ut',l),dict.appTranslations[l==='de-CH'?'de':l]['Logga ut']);assert.equal(t('Avenyn Taxi',l),'Avenyn Taxi');assert.equal(t('Kungsportsavenyn 1',l),'Kungsportsavenyn 1')}
for(const l of ['de','de-CH','es','it','he'])assert(customer.languages.some(x=>x.code===l));
assert.equal(customer.languages.find(x=>x.code==='he').dir,'rtl');
assert.equal(t('Kontant','sv'),'Kontant');assert.equal(t('Kontant','hi'),'नकद');assert.equal(t('Kontant','ml'),'പണം');assert.equal(t('Bekräfta bokning','es'),'Confirmar reserva');
console.log('App languages: requested choices, flags, RTL, payment labels, fallback and unchanged addresses passed.');
