-- v14: arregla el historial que no se veía + permisos de recepción sobre las fichas.
-- Ejecutar UNA VEZ en Supabase > SQL Editor.

-- 1) Los servicios de pestañas guardados desde la tablet dejaron el texto solo en "diseño"
--    y la ficha/agenda leían "observaciones". Se copia a observaciones donde estaba vacío.
update service_records
set historial_observaciones = diseno_pestanas
where coalesce(trim(historial_observaciones), '') = ''
  and coalesce(trim(diseno_pestanas), '') <> '';

-- 2) Recepción (secretaria) puede crear y completar fichas desde la ficha de la clienta.
--    Antes solo podían profesional/admin y el cambio se perdía sin avisar.
drop policy if exists "records_insert_profesional_admin" on service_records;
create policy "records_insert_profesional_admin" on service_records
  for insert with check (
    current_rol() in ('admin', 'secretaria')
    or (current_rol() = 'profesional'
        and staff_id = (select id from staff where auth_user_id = auth.uid()))
  );

drop policy if exists "records_update_own_or_admin" on service_records;
create policy "records_update_own_or_admin" on service_records
  for update using (
    current_rol() in ('admin', 'secretaria')
    or staff_id = (select id from staff where auth_user_id = auth.uid())
  );
