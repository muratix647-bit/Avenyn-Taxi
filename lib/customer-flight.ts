/** Replace only the structured flight field; preserve customer notes and stops. */
export function replaceFlightNumber(notes:unknown,flight:string){
 const rest=String(notes||'').replace(/flyg(?:nummer)?\s*[:#-]?\s*[a-z0-9]{2,3}\s?\d{1,4}[a-z]?/gi,'').replace(/(?:\s*·\s*){2,}/g,' · ').replace(/^\s*·\s*|\s*·\s*$/g,'').trim();
 return [flight&&`Flygnummer: ${flight}`,rest].filter(Boolean).join(' · ')||null;
}
