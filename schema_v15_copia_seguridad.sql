-- v15: red de seguridad para que NO se pierda ningún dato de visitas, servicios y profesionales.
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
--
-- Qué hace: cada vez que se BORRA o se MODIFICA una clienta, una cita de la agenda o una ficha de
-- servicio, guarda automáticamente una copia de cómo estaba antes en la tabla "copia_cambios".
-- Así, si alguien quita una cita o borra algo por error, se puede recuperar.
-- Solo el administrador puede ver esa tabla. No cambia nada de lo que ya funciona.

create table if not exists copia_cambios (
  id bigserial primary key,
  cuando timestamptz not null default now(),
  tabla text not null,
  accion text not null check (accion in ('borrado', 'modificado')),
  fila_id text,
  usuario uuid default auth.uid(),
  datos jsonb not null
);
create index if not exists idx_copia_cambios_tabla_cuando on copia_cambios(tabla, cuando desc);
create index if not exists idx_copia_cambios_fila on copia_cambios(fila_id);

alter table copia_cambios enable row level security;
drop policy if exists "copia_cambios_admin_lee" on copia_cambios;
create policy "copia_cambios_admin_lee" on copia_cambios
  for select using (current_rol() = 'admin');
-- nadie inserta ni borra directamente: solo los disparadores (security definer)

create or replace function guardar_copia_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Si por cualquier motivo no se pudiera guardar la copia, NUNCA se bloquea el trabajo normal.
  begin
    if (tg_op = 'DELETE') then
      insert into copia_cambios(tabla, accion, fila_id, datos)
      values (tg_table_name, 'borrado', old.id::text, to_jsonb(old));
    elsif to_jsonb(new) is distinct from to_jsonb(old) then
      insert into copia_cambios(tabla, accion, fila_id, datos)
      values (tg_table_name, 'modificado', old.id::text, to_jsonb(old));
    end if;
  exception when others then
    null;
  end;
  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists trg_copia_clients on clients;
create trigger trg_copia_clients
before update or delete on clients
for each row execute function guardar_copia_cambio();

drop trigger if exists trg_copia_records on service_records;
create trigger trg_copia_records
before update or delete on service_records
for each row execute function guardar_copia_cambio();

drop trigger if exists trg_copia_asignaciones on asignaciones_dia;
create trigger trg_copia_asignaciones
before update or delete on asignaciones_dia
for each row execute function guardar_copia_cambio();

-- Para recuperar una cita o ficha borrada (como administrador), por ejemplo:
--   select cuando, accion, datos from copia_cambios
--   where tabla = 'asignaciones_dia' and accion = 'borrado' order by cuando desc limit 20;
