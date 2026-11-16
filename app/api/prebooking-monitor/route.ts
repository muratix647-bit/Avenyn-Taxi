import {processCompanyInvoices} from '@/lib/company-auto-invoice';
import {processInvoicePlans} from '@/lib/invoice-sms';
import {runDriverReminders} from '@/lib/driver-reminder-monitor';
import {runCustomerSmsReminders} from '@/lib/customer-sms-monitor';
import {env} from 'cloudflare:workers';
import {runPrebookingMonitor} from '@/lib/prebooking-monitor';
export async function POST(request:Request) {
 const secret=String(env.FLIGHT_MONITOR_SECRET||'');
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Unauthorized'},{status:401});
 try {const body:any=await request.json().catch(()=>({}));if(!body.dryRun)await processInvoicePlans().catch(()=>console.error('invoice_sms_monitor_failed'));if(!body.dryRun)await processCompanyInvoices().catch(()=>console.error('company_invoice_monitor_failed'));const driverReminders=await runDriverReminders(body.dryRun===true);const reminders=await runCustomerSmsReminders(body.dryRun===true);return Response.json({ok:true,...await runPrebookingMonitor(body.dryRun===true),customerReminders:reminders,driverReminders});}
 catch(error){console.error('prebooking_monitor_failed',error);return Response.json({error:'Bevakningen kunde inte köras'},{status:500});}
}
