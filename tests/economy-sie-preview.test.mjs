import assert from 'node:assert/strict';
import { parseSIE4, decodeSIE } from '../components/sie4-preview.ts';
const valid = `#FLAGGA 0
#PROGRAM "Fortnox" 1
#FORMAT PC8
#SIETYP 4
#ORGNR 5565974796
#FNAMN "Exempel Taxi AB"
#RAR 0 20260101 20261231
#KONTO 1930 "Företagskonto"
#KONTO 3043 "Persontransport 6%"
#KONTO 2631 "Utgående moms 6%"
#VER A 1 20261105 "Fiktiv persontransport"
{
#TRANS 1930 {} 106.00 20261105 "Kort"
#TRANS 3043 {} -100.00 20261105 "Taxi"
#TRANS 2631 {} -6.00 20261105 "Moms"
}
`;
const x=parseSIE4(valid,'test.sie');
assert.equal(x.safeToConsiderForImport,true, JSON.stringify(x.warnings));
assert.equal(x.vouchers[0].debitOre,10600);
assert.equal(x.vouchers[0].creditOre,10600);
assert.equal(x.vouchers[0].lines[1].creditOre,10000);
assert.equal(x.organizationNumber,'5565974796');
const bad=parseSIE4(valid.replace('-6.00','-7.00'));
assert.equal(bad.safeToConsiderForImport,false);
assert.equal(bad.vouchers[0].balanced,false);
const cp437=Uint8Array.from([35,70,78,65,77,78,32,34,65,86,69,78,89,78,32,84,65,88,73,32,0x84,34]);
assert.equal(decodeSIE(cp437).includes('ä'),true);
const utf=new TextEncoder().encode(valid);
assert.ok(decodeSIE(utf).includes('#SIETYP 4'));
console.log('Passed: balanced SIE4, rejects unbalanced SIE4, CP437 Swedish letters, UTF8 decoding');
assert.equal(parseSIE4(valid.replace('#SIETYP 4','')).safeToConsiderForImport,false);
assert.equal(parseSIE4(valid.replace('20261105','20260230')).safeToConsiderForImport,false);
assert.equal(parseSIE4(valid.trim().slice(0,-1)).safeToConsiderForImport,false);
assert.equal(parseSIE4(valid+'#TRANS 1930 {} 100.00').safeToConsiderForImport,false);
console.log('PASS: missing type, impossible date, unclosed voucher and orphan transaction rejected');
