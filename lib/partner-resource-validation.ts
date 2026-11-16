import {z} from 'zod';
const text=(max:number)=>z.string().trim().min(1).max(max);
export const resourceRequestSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('driver'),details:z.object({full_name:text(120),email:z.string().trim().email().max(200).transform(v=>v.toLowerCase()),phone:z.string().trim().regex(/^\+?[\d ()-]{7,25}$/),license_number:text(50)})}),
 z.object({kind:z.literal('vehicle'),details:z.object({registration_number:z.string().trim().transform(v=>v.replace(/\s/g,'').toUpperCase()).pipe(z.string().regex(/^[A-Z0-9-]{3,15}$/)),make:text(60),model:text(100),passenger_capacity:z.coerce.number().int().min(1).max(9)})}),
]);
