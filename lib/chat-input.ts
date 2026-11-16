import {z} from 'zod';
export const chatInput=z.object({
  role:z.enum(['customer','driver','dispatch']),
  action:z.enum(['inbox','read','send','seen']),
  trackingToken:z.string().uuid().optional(),
  bookingId:z.string().uuid().optional(),
  driverId:z.string().uuid().optional(),
  text:z.string().trim().min(1).max(2000).optional(),
  requestId:z.string().uuid().optional(),
  threadId:z.string().uuid().optional(),
  before:z.string().regex(/^[1-9]\d{0,17}$/).optional(),
  seen:z.string().regex(/^\d{1,18}$/).optional(),
}).strict().superRefine((v,c)=>{
 if(v.role==='customer'&&!v.trackingToken)c.addIssue({code:'custom',message:'Bokningslänk saknas.'});
 if(v.role!=='customer'&&v.trackingToken)c.addIssue({code:'custom',message:'Fel inloggningssätt.'});
 if(v.role==='customer'&&v.driverId)c.addIssue({code:'custom',message:'Ogiltig mottagare.'});
 if(v.action==='send'&&(!v.text||!v.requestId))c.addIssue({code:'custom',message:'Skriv ett meddelande.'});
 if(v.action==='seen'&&!v.seen)c.addIssue({code:'custom',message:'Meddelande saknas.'});
});
