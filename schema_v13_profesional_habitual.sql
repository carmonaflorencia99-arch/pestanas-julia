-- v13: profesional habitual automático.
-- Si una clienta ya fue atendida por la misma profesional en 3 fechas distintas
-- (más de 2 veces) en la app, esa profesional pasa a ser su habitual.
-- No pisa una profesional habitual que ya esté puesta.

create or replace function asignar_profesional_habitual() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hab uuid;
begin
  if not exists (select 1 from clients where id = new.client_id and profesional_habitual_id is null) then
    return new;
  end if;
  if not exists (select 1 from staff where id = new.staff_id and rol = 'profesional' and activo) then
    return new;
  end if;
  select staff_id into hab
  from service_records
  where client_id = new.client_id and staff_id = new.staff_id
  group by staff_id
  having count(distinct (fecha at time zone 'Europe/Madrid')::date) >= 3;
  if hab is not null then
    update clients set profesional_habitual_id = hab
    where id = new.client_id and profesional_habitual_id is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_profesional_habitual on service_records;
create trigger trg_profesional_habitual
after insert on service_records
for each row execute function asignar_profesional_habitual();

-- Opcional, una sola vez: aplicar lo mismo a los registros que ya existen.
update clients c set profesional_habitual_id = x.staff_id
from (
  select distinct on (r.client_id) r.client_id, r.staff_id
  from service_records r
  join staff s on s.id = r.staff_id and s.rol = 'profesional' and s.activo
  group by r.client_id, r.staff_id
  having count(distinct (r.fecha at time zone 'Europe/Madrid')::date) >= 3
  order by r.client_id, count(*) desc
) x
where c.id = x.client_id and c.profesional_habitual_id is null;
