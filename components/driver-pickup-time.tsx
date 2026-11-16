import {CalendarClock} from 'lucide-react';
import {AppText} from '@/components/app-language';
import {driverPickupLabel} from '@/lib/driver-pickup-label';
export default function DriverPickupTime({trip}:{trip:{booking_date?:string;pickup_time?:string}}){
 return <div className="driverPickupTime"><CalendarClock aria-hidden="true"/><div><span><AppText text="Hämtning · svensk tid"/></span><strong>{driverPickupLabel(trip)}</strong></div></div>;
}
