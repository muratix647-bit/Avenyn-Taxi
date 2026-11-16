// Monetary fields use integer öre. VAT and partner commission are rounded per trip.
function driverAmounts(gross:number){
 const driverDeduction=Math.sign(gross)*Math.round(Math.abs(gross)*6/100);
 const driverBase=gross-driverDeduction;
 const driverShare=Math.sign(driverBase)*Math.round(Math.abs(driverBase)*30/100);
 return {driverDeduction,driverBase,driverShare};
}
export function tripCommission(amount: unknown) {
 const value=Number(amount);
 const gross=Number.isFinite(value)?Math.sign(value)*Math.round(Math.abs(value)*100):0;
 const net=Math.sign(gross)*Math.round(Math.abs(gross)*100/106);
 const commission=Math.sign(gross)*Math.round(Math.abs(gross)/10);
 return {gross,vat:gross-net,net,commission,remainder:gross-commission,...driverAmounts(gross)};
}
export function sumCommission(amounts:unknown[]){
 const total=amounts.reduce<{gross:number;vat:number;net:number;commission:number;remainder:number}>((sum,amount)=>{
  const row=tripCommission(amount);
  return {gross:sum.gross+row.gross,vat:sum.vat+row.vat,net:sum.net+row.net,commission:sum.commission+row.commission,remainder:sum.remainder+row.remainder};
 },{gross:0,vat:0,net:0,commission:0,remainder:0});
 // Driver agreement: 6% deduction from the selected gross total, then 30% share.
 return {...total,...driverAmounts(total.gross)};
}
