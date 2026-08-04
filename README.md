# Las Pestañas de Julia — Fichas Técnicas Digitales

Plataforma interna para consultar y cargar fichas técnicas de clientas.
**No gestiona turnos** (eso lo sigue haciendo Flowww) — es exclusivamente
el historial técnico de cada clienta: servicios realizados, observaciones
y alertas de salud.

## Roles

- **Secretaria**: busca clientas, da de alta clientas nuevas, ve el historial completo.
- **Profesional**: ve todas las clientas, carga fichas de servicio, edita/borra solo sus propias fichas.
- **Admin**: todo lo anterior + gestión de personal, catálogo de servicios y exportación a CSV.

---

## 1. Configurar Supabase (una sola vez)

1. Crea una cuenta gratuita en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. Ve a **SQL Editor** → pega y ejecuta el contenido completo de `schema.sql`.
3. Ve a **Project Settings → API** y copia:
   - `Project URL` → lo usarás como `VITE_SUPABASE_URL`
   - `anon public key` → lo usarás como `VITE_SUPABASE_ANON_KEY`

## 2. Dar de alta a la primera admin

1. En Supabase Dashboard: **Authentication → Users → Add user**.
   - Email: por ejemplo `julia@laspestanasdejulia.local` (no necesita ser un email real, es solo un identificador interno)
   - Password: el PIN elegido (mínimo 6 caracteres, recomendado 6 dígitos)
2. Copia el **UUID** del usuario recién creado (aparece en la lista de usuarios).
3. Ve a **SQL Editor** y ejecuta (cambiando los datos):

```sql
insert into staff (auth_user_id, nombre, email_auth, rol)
values ('PEGA-AQUI-EL-UUID', 'Julia', 'julia@laspestanasdejulia.local', 'admin');
```

4. A partir de aquí, esa admin puede dar de alta al resto del personal desde el
   **Panel de Administración** dentro de la propia app (solo necesita repetir el
   paso 1-2 de arriba en Supabase para generar el UUID de cada nueva persona,
   y luego pegarlo en el panel).

## 3. Probar en local (opcional pero recomendado)

Necesitas tener [Node.js](https://nodejs.org) instalado.

```bash
npm install
cp .env.example .env.local
# Edita .env.local y pega tu URL y anon key de Supabase
npm run dev
```

Abre `http://localhost:5173`.

## 4. Desplegar en Vercel (recomendado)

1. Sube esta carpeta a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com), pulsa **Add New → Project** y selecciona el repo.
3. Vercel detecta Vite automáticamente. Antes de desplegar, ve a
   **Environment Variables** y añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Pulsa **Deploy**. En 1-2 minutos tendrás una URL como `pestanas-julia.vercel.app`.
5. (Opcional) En **Settings → Domains** puedes conectar un dominio propio,
   por ejemplo `fichas.laspestanasdejulia.com`.

## 5. Uso diario

- Cada persona del equipo entra a la URL, toca su nombre y escribe su PIN.
- La secretaria puede buscar o dar de alta clientas.
- Las profesionales cargan la ficha después de cada servicio.
- La admin puede exportar todo el historial a CSV en cualquier momento
  (botón "Exportar CSV" en la cabecera).

## Seguridad — puntos clave

- Los datos están protegidos con **Row Level Security** en Supabase: cada
  rol solo puede hacer lo que le corresponde, aunque alguien intente
  llamar a la base de datos directamente.
- Las alertas de salud son un dato sensible (RGPD). Se recomienda pedir
  consentimiento a la clienta para registrarlas y no compartir capturas
  de pantalla de la app fuera del equipo.
- El PIN nunca se guarda en texto plano: se almacena como contraseña
  cifrada dentro de Supabase Auth.
- Revisa periódicamente el listado de personal activo/inactivo en el
  Panel de Administración cuando alguien deja el equipo.
