-- v16: GUARDADO AUTOMÁTICO de las visitas.
-- Aunque la profesional no confirme ni nadie marque "llegó" (hay mucha faena y se puede olvidar), cada cita
-- de la agenda de un día que ya pasó queda SIEMPRE registrada en su historial: cuándo vino, qué servicio y
-- con quién. Si una clienta NO vino, se quita la cita de la agenda ("Quitar" / "No vino"); queda copia en v15.
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
--
-- Regla: cuando pasa el día, a cada cita que no tenga su ficha,
-- se le crea sola, con la profesional de la cita y la fecha de la cita:
--   1) con el historial que cargó recepción para esa cita, o
--   2) si no hay, con el último historial de la clienta de ese mismo tipo de servicio (se anota
--      "copiado de la visita anterior"), o
--   3) en pestañas, si tampoco hay, con sus notas generales (por ejemplo las de Flowww), o
--   4) si no hay nada: "Pendiente de cargar historial" en pestañas, o "Servicio realizado (sin observaciones)"
--      en el resto de servicios, donde el historial no es obligatorio.
-- La app llama a esta función sola al abrirse. Si la profesional confirma antes, no se duplica nada.

create or replace function cerrar_visitas_pasadas() returns integer
language plpgsql security definer set search_path = public as $$
declare
  a record;
  sv record;
  hechos integer;
  necesarios integer;
  previo text;
  notas text;
  texto text;
  es_pestanas boolean;
  creados integer := 0;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  for a in
    select * from asignaciones_dia
    where tipo is distinct from 'descanso'
      and client_id is not null
      and staff_id is not null
      and fecha < hoy
      and fecha >= hoy - 90
    order by fecha
  loop
    necesarios := greatest(1, case when jsonb_typeof(a.servicios) = 'array' then jsonb_array_length(a.servicios) else 1 end);

    select count(*) into hechos
    from service_records r
    where r.client_id = a.client_id
      and r.staff_id = a.staff_id
      and coalesce(r.es_extra, false) = false
      and (r.fecha at time zone 'Europe/Madrid')::date = a.fecha;

    if hechos >= necesarios then
      continue;
    end if;

    select nullif(trim(notas_generales), '') into notas from clients where id = a.client_id;

    for sv in
      select
        coalesce(nullif(trim(e.value ->> 'categoria_servicio'), ''), 'Servicio') as categoria,
        coalesce(nullif(trim(e.value ->> 'subtipo_servicio'), ''), 'Sin especificar') as subtipo,
        nullif(trim(e.value ->> 'historial_observaciones'), '') as historial,
        e.ord
      from jsonb_array_elements(
             case when jsonb_typeof(a.servicios) = 'array' and jsonb_array_length(a.servicios) > 0
                  then a.servicios
                  else jsonb_build_array(jsonb_build_object('categoria_servicio', coalesce(a.categoria_servicio, 'Servicio'),
                                                            'subtipo_servicio', coalesce(a.subtipo_servicio, 'Sin especificar'),
                                                            'historial_observaciones', a.historial_observaciones))
             end
           ) with ordinality as e(value, ord)
      where e.ord > hechos
      order by e.ord
    loop
      es_pestanas := lower(sv.categoria) like '%pesta%' or lower(sv.categoria) like '%extens%';

      -- último historial real de la clienta PARA ESE MISMO TIPO de servicio
      select coalesce(nullif(trim(r.historial_observaciones), ''), nullif(trim(r.diseno_pestanas), ''))
        into previo
      from service_records r
      where r.client_id = a.client_id
        and coalesce(r.es_extra, false) = false
        and lower(trim(r.categoria_servicio)) = lower(trim(sv.categoria))
        and coalesce(nullif(trim(r.historial_observaciones), ''), nullif(trim(r.diseno_pestanas), '')) is not null
        and lower(trim(coalesce(r.historial_observaciones, ''))) <> 'pendiente de cargar historial'
        and coalesce(r.historial_observaciones, '') not like '%(copiado de la visita anterior%'
        and coalesce(r.historial_observaciones, '') not like '%(notas de la clienta, sin confirmar)%'
        and (r.fecha at time zone 'Europe/Madrid')::date < a.fecha
      order by r.fecha desc
      limit 1;

      if sv.historial is not null and lower(sv.historial) <> 'puesta nueva' then
        texto := sv.historial;
      elsif previo is not null then
        texto := previo || ' (copiado de la visita anterior, sin confirmar)';
      elsif es_pestanas and notas is not null then
        texto := notas || ' (notas de la clienta, sin confirmar)';
      elsif es_pestanas then
        texto := 'Pendiente de cargar historial';
      else
        texto := 'Servicio realizado (sin observaciones)';
      end if;

      insert into service_records (client_id, staff_id, fecha, categoria_servicio, subtipo_servicio, historial_observaciones)
      values (a.client_id, a.staff_id, (a.fecha::timestamp + interval '12 hours') at time zone 'Europe/Madrid',
              sv.categoria, sv.subtipo, texto);
      creados := creados + 1;
    end loop;

    update asignaciones_dia set estado = 'completado' where id = a.id and estado is distinct from 'completado';
  end loop;

  return creados;
end $$;

revoke all on function cerrar_visitas_pasadas() from public;
grant execute on function cerrar_visitas_pasadas() to authenticated;

-- Opcional: ejecutarla ahora mismo para ponerse al día con los días anteriores.
select cerrar_visitas_pasadas() as fichas_creadas;
