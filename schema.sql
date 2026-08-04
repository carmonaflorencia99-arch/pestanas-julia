-- ============================================================
-- LAS PESTAÑAS DE JULIA · Fichas Técnicas Digitales
-- Esquema de base de datos para Supabase (Postgres + RLS)
-- ============================================================
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLA: staff (personal del salón)
-- ------------------------------------------------------------
-- auth_user_id conecta este registro con un usuario real de
-- Supabase Auth. El "PIN" que teclea la profesional se guarda
-- como su contraseña de Auth (hasheada por Supabase), NUNCA en
-- texto plano en esta tabla.
create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nombre text not null,
  -- email_auth es el email "técnico" interno usado solo para el login
  -- (ej. maria@laspestanasdejulia.local). No es un dato de contacto real.
  email_auth text not null unique,
  rol text not null check (rol in ('secretaria', 'profesional', 'admin')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. TABLA: servicios_catalogo (editable solo por admin)
-- ------------------------------------------------------------
create table servicios_catalogo (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  subtipo text not null,
  activo boolean not null default true,
  orden integer default 0,
  unique (categoria, subtipo)
);

insert into servicios_catalogo (categoria, subtipo, orden) values
  ('Extensiones de pestañas', 'Clásicas', 1),
  ('Extensiones de pestañas', 'Reposición Clásicas', 2),
  ('Extensiones de pestañas', '2D', 3),
  ('Extensiones de pestañas', 'Reposición 2D', 4),
  ('Extensiones de pestañas', 'Volumen', 5),
  ('Extensiones de pestañas', 'Reposición volumen', 6),
  ('Extensiones de pestañas', 'Mega volumen', 7),
  ('Extensiones de pestañas', 'Reposición mega volumen', 8),
  ('Lifting y Cejas', 'Lifting de pestañas con o sin tinte', 1),
  ('Lifting y Cejas', 'Lifting premium', 2),
  ('Lifting y Cejas', 'Laminado de cejas con tinte y/o depilación', 3),
  ('Lifting y Cejas', 'Depilación de cejas con hilo', 4),
  ('Depilación Facial', 'Depilación facial', 1),
  ('Depilación Facial', 'Depilación labio', 2),
  ('Manicura', 'Manicura tradicional', 1),
  ('Manicura', 'Manicura semipermanente', 2),
  ('Manicura', 'Uñas esculpidas / gel', 3),
  ('Pedicura', 'Pedicura tradicional', 1),
  ('Pedicura', 'Pedicura semipermanente', 2),
  ('Micropigmentación', 'Cejas', 1),
  ('Micropigmentación', 'Labios', 2),
  ('Micropigmentación', 'Retoque', 3);

-- ------------------------------------------------------------
-- 3. TABLA: clients (clientas)
-- ------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  alertas_salud text,
  notas_generales text,
  creado_por uuid references staff(id),
  creado_en timestamptz not null default now()
);

create index idx_clients_nombre on clients using gin (nombre gin_trgm_ops);
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- 4. TABLA: service_records (fichas de cada servicio realizado)
-- ------------------------------------------------------------
create table service_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  staff_id uuid not null references staff(id),
  fecha timestamptz not null default now(),
  categoria_servicio text not null,
  subtipo_servicio text not null,
  historial_observaciones text,
  creado_en timestamptz not null default now()
);

create index idx_records_client on service_records(client_id);
create index idx_records_staff on service_records(staff_id);

-- ------------------------------------------------------------
-- 5. FUNCIÓN AUXILIAR: obtener el registro de staff del usuario logueado
-- ------------------------------------------------------------
create or replace function current_staff()
returns staff as $$
  select * from staff where auth_user_id = auth.uid() and activo = true limit 1;
$$ language sql stable security definer;

create or replace function current_rol()
returns text as $$
  select rol from staff where auth_user_id = auth.uid() and activo = true limit 1;
$$ language sql stable security definer;

-- ------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table staff enable row level security;
alter table servicios_catalogo enable row level security;
alter table clients enable row level security;
alter table service_records enable row level security;

-- STAFF: cualquier usuaria autenticada puede ver el listado
-- (necesario para la pantalla de login y para ver "quién atendió"),
-- pero solo admin puede crear/editar/borrar personal.
create policy "staff_select_authenticated" on staff
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "staff_insert_admin" on staff
  for insert with check (current_rol() = 'admin');

create policy "staff_update_admin" on staff
  for update using (current_rol() = 'admin');

create policy "staff_delete_admin" on staff
  for delete using (current_rol() = 'admin');

-- CATÁLOGO: todo el staff logueado puede leer, solo admin edita
create policy "catalogo_select_authenticated" on servicios_catalogo
  for select using (auth.role() = 'authenticated');

create policy "catalogo_write_admin" on servicios_catalogo
  for all using (current_rol() = 'admin') with check (current_rol() = 'admin');

-- CLIENTES: secretaria y admin pueden crear; todo el staff logueado
-- (secretaria, profesional, admin) puede ver.
create policy "clients_select_authenticated" on clients
  for select using (auth.role() = 'authenticated');

create policy "clients_insert_secretaria_admin" on clients
  for insert with check (current_rol() in ('secretaria', 'admin'));

create policy "clients_update_secretaria_admin" on clients
  for update using (current_rol() in ('secretaria', 'admin'));

-- FICHAS DE SERVICIO: todo el staff logueado puede ver (acceso
-- completo acordado). Solo profesional/admin puede crear.
-- Editar/borrar: la propia profesional que la creó, o admin.
create policy "records_select_authenticated" on service_records
  for select using (auth.role() = 'authenticated');

create policy "records_insert_profesional_admin" on service_records
  for insert with check (
    current_rol() in ('profesional', 'admin')
    and (current_rol() = 'admin' or staff_id = (select id from staff where auth_user_id = auth.uid()))
  );

create policy "records_update_own_or_admin" on service_records
  for update using (
    current_rol() = 'admin'
    or staff_id = (select id from staff where auth_user_id = auth.uid())
  );

create policy "records_delete_own_or_admin" on service_records
  for delete using (
    current_rol() = 'admin'
    or staff_id = (select id from staff where auth_user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- NOTA IMPORTANTE PARA EL ALTA DE PERSONAL
-- ------------------------------------------------------------
-- Para dar de alta a una nueva profesional/secretaria con su PIN:
-- 1. Supabase Dashboard > Authentication > Users > Add user
--    Email: cualquier email interno, ej. maria@laspestanasdejulia.local
--    Password: el PIN elegido (ej. 4821) — mínimo 6 caracteres,
--    así que se recomienda PIN de 6 dígitos.
-- 2. Copiar el UUID del usuario creado.
-- 3. Insertar en staff:
--    insert into staff (auth_user_id, nombre, email_auth, rol)
--    values ('UUID-COPIADO', 'María', 'maria@laspestanasdejulia.local', 'profesional');
--
-- La app incluye un panel de Admin que automatiza esto sin
-- tener que entrar al Dashboard cada vez (ver AdminPanel.jsx).
