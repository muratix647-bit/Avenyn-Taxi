update public.price_zones
set region = 'Halland'
where name in ('Kungsbacka','Kullavik','Onsala','Särö')
  and region is distinct from 'Halland';
