-- ============================================================
-- LAS PESTAÑAS DE JULIA · Inventario de cajas de pestañas
-- ============================================================
-- Ejecutar UNA VEZ completo en: Supabase Dashboard > SQL Editor > New query
-- (después de schema.sql y de las migraciones anteriores).
-- No toca ninguna tabla existente: solo añade tablas y funciones nuevas.
--
-- Cómo funciona:
--  · inv_referencias: cada combinación tipo + largo (ej. "2D LU · 11 mm")
--    con su stock mínimo para los avisos.
--  · inv_cajas: una fila por caja física. "codigo" es el número tid del
--    QR de DeceMars (único por caja). Las cajas sin QR llevan codigo vacío.
--  · El stock de una referencia = cajas con estado 'en_almacen'.
--
-- Permisos:
--  · Admin: ve y modifica todo.
--  · Profesional: solo puede registrar las cajas que saca (a través de
--    funciones seguras) y ver SUS propias salidas. No puede ver el stock.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABLAS
-- ------------------------------------------------------------
create table if not exists inv_referencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  largo integer not null check (largo between 4 and 25),
  stock_minimo integer not null default 2 check (stock_minimo >= 0),
  orden_tipo integer not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (tipo, largo)
);

create table if not exists inv_cajas (
  id uuid primary key default gen_random_uuid(),
  -- número "tid" del QR de la caja. Vacío (null) si la caja no tiene QR.
  codigo text unique,
  referencia_id uuid not null references inv_referencias(id),
  estado text not null default 'en_almacen' check (estado in ('en_almacen', 'sacada')),
  -- recuento: alta en el recuento inicial · pedido: entrada de un pedido nuevo
  -- manual: alta sin QR · sin_registrar: apareció al sacarla, nunca se dio de alta
  origen text not null default 'pedido' check (origen in ('recuento', 'pedido', 'manual', 'sin_registrar')),
  entrada_en timestamptz not null default now(),
  entrada_por uuid references staff(id) on delete set null,
  salida_en timestamptz,
  salida_por uuid references staff(id) on delete set null,
  -- true si la salida se registró a mano, sin escanear el QR de la caja
  salida_manual boolean not null default false,
  nota text
);

create index if not exists idx_inv_cajas_ref_estado on inv_cajas(referencia_id, estado);
create index if not exists idx_inv_cajas_salida_por on inv_cajas(salida_por);
create index if not exists idx_inv_cajas_salida_en on inv_cajas(salida_en desc);
create index if not exists idx_inv_cajas_entrada_en on inv_cajas(entrada_en desc);


-- ------------------------------------------------------------
-- 2. REFERENCIAS INICIALES: 21 tipos × largos de 8 a 14 mm
--    Stock mínimo de 2 cajas (se cambia desde la app).
-- ------------------------------------------------------------
insert into inv_referencias (tipo, largo, orden_tipo)
select t.tipo, l.largo, t.orden
from (values
  ('2D LU', 1), ('3D W LU', 2), ('MTC', 3), ('BPC', 4), ('0.25 C', 5),
  ('0.25 L', 6), ('2D C', 7), ('2D D', 8), ('MTD', 9), ('BPB', 10),
  ('0.25 D', 11), ('3D C', 12), ('3D D', 13), ('10D 0.07', 14), ('0.10 D', 15),
  ('VOLUMEN D', 16), ('0.07 C', 17), ('0.10 C', 18), ('2D 0.20', 19),
  ('Marrones C', 20), ('2D L+', 21)
) as t(tipo, orden)
cross join generate_series(8, 14) as l(largo)
on conflict (tipo, largo) do nothing;


-- ------------------------------------------------------------
-- 3. FUNCIÓN AUXILIAR: id de staff de quien está conectada
-- ------------------------------------------------------------
create or replace function current_staff_id()
returns uuid as $$
  select id from staff where auth_user_id = auth.uid() and activo = true limit 1;
$$ language sql stable security definer set search_path = public;


-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table inv_referencias enable row level security;
alter table inv_cajas enable row level security;

-- Referencias (tipo + largo + mínimo): todo el staff las lee para poder
-- elegir tipo y largo al sacar una caja. No contienen el stock.
drop policy if exists "inv_ref_select" on inv_referencias;
create policy "inv_ref_select" on inv_referencias
  for select using (auth.role() = 'authenticated');

drop policy if exists "inv_ref_write_admin" on inv_referencias;
create policy "inv_ref_write_admin" on inv_referencias
  for all using (current_rol() = 'admin') with check (current_rol() = 'admin');

-- Cajas: la admin ve todo; cada profesional solo las cajas que ELLA sacó.
drop policy if exists "inv_cajas_select" on inv_cajas;
create policy "inv_cajas_select" on inv_cajas
  for select using (
    current_rol() = 'admin'
    or salida_por = current_staff_id()
  );

-- Altas, cambios y borrados directos: solo admin. Las profesionales
-- registran salidas mediante las funciones de abajo.
drop policy if exists "inv_cajas_write_admin" on inv_cajas;
create policy "inv_cajas_write_admin" on inv_cajas
  for all using (current_rol() = 'admin') with check (current_rol() = 'admin');


-- ------------------------------------------------------------
-- 5. VISTA DE STOCK (solo devuelve datos a la admin)
-- ------------------------------------------------------------
create or replace view inv_stock with (security_invoker = true) as
select
  r.id as referencia_id,
  r.tipo,
  r.largo,
  r.stock_minimo,
  r.orden_tipo,
  r.activo,
  count(c.id) filter (where c.estado = 'en_almacen')::int as en_almacen
from inv_referencias r
left join inv_cajas c on c.referencia_id = r.id
where current_rol() = 'admin'
group by r.id;


-- ------------------------------------------------------------
-- 6. FUNCIONES
-- ------------------------------------------------------------

-- Consultar a qué referencia pertenece un QR (sin revelar stock).
create or replace function inv_consultar_codigo(p_codigo text)
returns json as $$
declare
  v_caja inv_cajas;
  v_ref inv_referencias;
begin
  if current_rol() not in ('admin', 'profesional') then
    raise exception 'Sin permiso';
  end if;

  select * into v_caja from inv_cajas where codigo = p_codigo;
  if not found then
    return json_build_object('estado', 'desconocido');
  end if;

  select * into v_ref from inv_referencias where id = v_caja.referencia_id;
  return json_build_object(
    'estado', v_caja.estado,
    'referencia_id', v_ref.id,
    'tipo', v_ref.tipo,
    'largo', v_ref.largo
  );
end;
$$ language plpgsql security definer set search_path = public;


-- ALTA de una caja (recuento inicial o pedido nuevo). Solo admin.
-- Si el QR ya estaba registrado, no lo duplica y avisa.
create or replace function inv_alta_caja(p_codigo text, p_referencia_id uuid, p_origen text default 'pedido')
returns json as $$
declare
  v_caja inv_cajas;
  v_ref inv_referencias;
begin
  if current_rol() <> 'admin' then
    raise exception 'Solo la admin puede dar de alta cajas';
  end if;

  if p_codigo is not null then
    select * into v_caja from inv_cajas where codigo = p_codigo;
    if found then
      select * into v_ref from inv_referencias where id = v_caja.referencia_id;
      return json_build_object(
        'estado', case when v_caja.estado = 'sacada' then 'ya_sacada' else 'duplicada' end,
        'tipo', v_ref.tipo,
        'largo', v_ref.largo
      );
    end if;
  end if;

  insert into inv_cajas (codigo, referencia_id, origen, entrada_por)
  values (p_codigo, p_referencia_id, coalesce(p_origen, 'pedido'), current_staff_id());

  return json_build_object('estado', 'ok');
end;
$$ language plpgsql security definer set search_path = public;


-- ALTA de varias cajas SIN QR de golpe. Solo admin.
create or replace function inv_alta_sin_codigo(p_referencia_id uuid, p_cantidad integer, p_origen text default 'manual')
returns json as $$
begin
  if current_rol() <> 'admin' then
    raise exception 'Solo la admin puede dar de alta cajas';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 500 then
    raise exception 'Cantidad no válida';
  end if;

  insert into inv_cajas (codigo, referencia_id, origen, entrada_por)
  select null, p_referencia_id, coalesce(p_origen, 'manual'), current_staff_id()
  from generate_series(1, p_cantidad);

  return json_build_object('estado', 'ok', 'cantidad', p_cantidad);
end;
$$ language plpgsql security definer set search_path = public;


-- SALIDA de una caja del almacén. Profesionales y admin.
--  · Con QR conocido: se marca como sacada.
--  · Con QR desconocido: hay que indicar la referencia; se registra
--    como caja "sin_registrar" ya sacada (para que la admin lo vea).
--  · Sin QR (p_codigo vacío): se descuenta una caja de esa referencia.
create or replace function inv_registrar_salida(p_codigo text, p_referencia_id uuid default null)
returns json as $$
declare
  v_yo uuid := current_staff_id();
  v_caja inv_cajas;
  v_otra inv_cajas;
  v_ref inv_referencias;
  v_quien text;
begin
  if current_rol() not in ('admin', 'profesional') then
    raise exception 'Sin permiso';
  end if;

  -- ---- Caja escaneada con QR ----
  if p_codigo is not null and p_codigo <> '' then
    select * into v_caja from inv_cajas where codigo = p_codigo for update;

    if found then
      select * into v_ref from inv_referencias where id = v_caja.referencia_id;

      if v_caja.estado = 'en_almacen' then
        update inv_cajas
          set estado = 'sacada', salida_en = now(), salida_por = v_yo, salida_manual = false
          where id = v_caja.id;
        return json_build_object('estado', 'ok', 'tipo', v_ref.tipo, 'largo', v_ref.largo);
      end if;

      -- Ya figuraba como sacada. Si esa salida se apuntó a mano (sin
      -- escanear), en realidad se llevaron OTRA caja igual: se corrige
      -- intercambiando la salida manual a otra caja de la misma referencia.
      if v_caja.salida_manual then
        select * into v_otra from inv_cajas
          where referencia_id = v_caja.referencia_id and estado = 'en_almacen'
          order by (codigo is null) desc, entrada_en
          limit 1 for update;
        if found then
          update inv_cajas
            set estado = 'sacada', salida_en = v_caja.salida_en, salida_por = v_caja.salida_por, salida_manual = true
            where id = v_otra.id;
          update inv_cajas
            set salida_en = now(), salida_por = v_yo, salida_manual = false
            where id = v_caja.id;
          return json_build_object('estado', 'ok', 'tipo', v_ref.tipo, 'largo', v_ref.largo);
        end if;
      end if;

      select nombre into v_quien from staff where id = v_caja.salida_por;
      return json_build_object(
        'estado', 'ya_sacada',
        'tipo', v_ref.tipo,
        'largo', v_ref.largo,
        'salida_en', v_caja.salida_en,
        'salida_por', v_quien
      );
    end if;

    -- QR que nunca se dio de alta
    if p_referencia_id is null then
      return json_build_object('estado', 'desconocido');
    end if;

    select * into v_ref from inv_referencias where id = p_referencia_id;
    if not found then
      raise exception 'Referencia no encontrada';
    end if;

    insert into inv_cajas (codigo, referencia_id, estado, origen, entrada_por, salida_en, salida_por)
    values (p_codigo, p_referencia_id, 'sacada', 'sin_registrar', v_yo, now(), v_yo);
    return json_build_object('estado', 'ok', 'tipo', v_ref.tipo, 'largo', v_ref.largo, 'sin_registrar', true);
  end if;

  -- ---- Salida a mano, sin QR ----
  if p_referencia_id is null then
    raise exception 'Falta indicar tipo y largo';
  end if;

  select * into v_ref from inv_referencias where id = p_referencia_id;
  if not found then
    raise exception 'Referencia no encontrada';
  end if;

  -- Primero se descuentan cajas sin QR; si no hay, la caja con QR más antigua.
  select * into v_caja from inv_cajas
    where referencia_id = p_referencia_id and estado = 'en_almacen'
    order by (codigo is null) desc, entrada_en
    limit 1 for update;

  if found then
    update inv_cajas
      set estado = 'sacada', salida_en = now(), salida_por = v_yo, salida_manual = true
      where id = v_caja.id;
    return json_build_object('estado', 'ok', 'tipo', v_ref.tipo, 'largo', v_ref.largo);
  end if;

  -- No quedaba ninguna en el sistema: se apunta igualmente para que la admin lo vea.
  insert into inv_cajas (codigo, referencia_id, estado, origen, entrada_por, salida_en, salida_por, salida_manual)
  values (null, p_referencia_id, 'sacada', 'sin_registrar', v_yo, now(), v_yo, true);
  return json_build_object('estado', 'ok', 'tipo', v_ref.tipo, 'largo', v_ref.largo, 'sin_registrar', true);
end;
$$ language plpgsql security definer set search_path = public;


-- DESHACER una salida (caja devuelta al almacén o registrada por error).
-- La admin puede deshacer cualquiera; la profesional solo las suyas de
-- las últimas 12 horas.
create or replace function inv_deshacer_salida(p_caja_id uuid)
returns json as $$
declare
  v_caja inv_cajas;
begin
  select * into v_caja from inv_cajas where id = p_caja_id for update;
  if not found or v_caja.estado <> 'sacada' then
    return json_build_object('estado', 'no_encontrada');
  end if;

  if not (
    current_rol() = 'admin'
    or (current_rol() = 'profesional'
        and v_caja.salida_por = current_staff_id()
        and v_caja.salida_en > now() - interval '12 hours')
  ) then
    raise exception 'Sin permiso para deshacer esta salida';
  end if;

  update inv_cajas
    set estado = 'en_almacen', salida_en = null, salida_por = null, salida_manual = false
    where id = p_caja_id;
  return json_build_object('estado', 'ok');
end;
$$ language plpgsql security definer set search_path = public;


-- Permisos de ejecución: solo usuarias con sesión iniciada.
revoke all on function inv_consultar_codigo(text) from public, anon;
revoke all on function inv_alta_caja(text, uuid, text) from public, anon;
revoke all on function inv_alta_sin_codigo(uuid, integer, text) from public, anon;
revoke all on function inv_registrar_salida(text, uuid) from public, anon;
revoke all on function inv_deshacer_salida(uuid) from public, anon;
grant execute on function inv_consultar_codigo(text) to authenticated;
grant execute on function inv_alta_caja(text, uuid, text) to authenticated;
grant execute on function inv_alta_sin_codigo(uuid, integer, text) to authenticated;
grant execute on function inv_registrar_salida(text, uuid) to authenticated;
grant execute on function inv_deshacer_salida(uuid) to authenticated;
grant select on inv_stock to authenticated;
