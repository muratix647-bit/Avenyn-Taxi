import { z } from 'zod';
const text = (max: number) => z.string().trim().min(1).max(max);
export const partnerApplicationSchema = z.object({
 company: text(150),
 org_number: z.string().trim().transform(v => v.replace(/[-\s]/g, '')).pipe(z.string().regex(/^\d{10}$/)),
 contact_name: text(120),
 email: z.string().trim().email().max(200).transform(v => v.toLowerCase()),
 phone: z.string().trim().regex(/^\+?[\d ()-]{7,25}$/),
 permit_number: text(100),
 vehicle_count: z.coerce.number().int().min(1).max(5000),
 area: text(300),
 message: z.string().trim().max(2000).default(''),
});
export const partnerStatuses: Record<string, string> = {new:'Ny ansökan',contacted:'Kontaktad',approved:'Godkänd för samarbete',rejected:'Avslagen'};
