const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n],Intl,Date,Map,Number,String});return exports;}
const times=load('lib/prebooking-watch.ts');
const {prebookingBoard}=load('lib/driver-prebooking-board.ts',{'./prebooking-watch':times});
const now=Date.parse('2026-10-24T18:00:00Z');
const base={id:'a',booking_number:153,booking_date:'2026-10-25',pickup_time:'12:00:00',created_at:'2026-10-23T10:00:00Z',price_breakdown:{dispatch_mode:'prebooking',secret:'private'},status:'new',customer_phone:'private',customer_name:'private'};
const rows=[base,{...base,id:'assigned',driver_id:'other',status:'accepted'},{...base,id:'mine',driver_id:'me',status:'accepted'},{...base,id:'past',booking_date:'2026-10-23'},{...base,id:'instant',price_breakdown:{dispatch_mode:'instant'}},{...base,id:'pet',pet_details:{dog:1}}];
const board=prebookingBoard(rows,[base], 'me',false,now);
assert.equal(board.length,5);assert.equal(board[0].can_claim,true);
assert.ok(!board.some(b=>b.id==='assigned'),'another driver must not see accepted trips');
assert.equal(board[1].assigned_to_me,true);assert.equal(board[4].can_claim,false);
assert.ok(!JSON.stringify(board).includes('private'));
assert.equal(prebookingBoard([base],[], 'me',false,now)[0].can_claim,false,'stale pool cannot grant a claim');
assert.equal(times.pickupAt(base),Date.parse('2026-10-25T11:00:00Z'),'Swedish winter-time pickup');
console.log('PASS: shared visibility, claim eligibility, privacy, overdue and instant visibility and Swedish time');

assert.equal(prebookingBoard([rows[4]],[rows[4]],'me',false,now)[0].can_claim,true,'instant bookings must be offered too');

const overdue=prebookingBoard([rows[3]],[rows[3]],'me',false,now)[0];assert.equal(overdue.can_claim,true);assert.equal(overdue.overdue,true,'unassigned past bookings remain visible with a warning');

for(const status of ['offered','assigned','accepted','en_route','arrived','passenger_onboard']) assert.equal(prebookingBoard([{...base,driver_id:'other',status}],[base],'me',false,now).length,0,'hide other drivers even with stale pool: '+status);
assert.equal(prebookingBoard([{...base,assigned_partner_id:'partner'}],[base],'me',false,now).length,0);
assert.equal(prebookingBoard([{...base,driver_id:null,status:'new'}],[base],'me',false,now).length,1,'reopened trips return to the board');
