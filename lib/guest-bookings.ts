export type GuestBooking={token:string;number:string;pickupTime:string;savedAt:number};
const key='avenyn-guest-bookings-v1';
export function readGuestBookings():GuestBooking[]{try{const rows=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.token==='string'&&/^[0-9a-f-]{36}$/i.test(r.token)&&typeof r.number==='string'&&typeof r.pickupTime==='string').slice(0,20):[];}catch{return [];}}
export function saveGuestBooking(booking:GuestBooking){const rows=[booking,...readGuestBookings().filter(r=>r.token!==booking.token)].slice(0,20);try{localStorage.setItem(key,JSON.stringify(rows));return {rows,persisted:true};}catch{return {rows,persisted:false};}}
