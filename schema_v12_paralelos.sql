-- OPCIONAL pero recomendado: permite que cada profesional vea que su clienta
-- también está con otra profesional a la misma hora (servicios en paralelo).
-- Solo AÑADE permiso de lectura de la agenda; no modifica ni borra datos.
-- Si ya podían verlo, no pasa nada por ejecutarlo.
drop policy if exists "asignaciones_lectura_equipo" on asignaciones_dia;
create policy "asignaciones_lectura_equipo" on asignaciones_dia
  for select to authenticated using (true);
