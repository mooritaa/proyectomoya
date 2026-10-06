-- ============================================================
-- POCKETWORK · Tablas nuevas: reportes, seguimientos, vistas,
-- retos + perfil laboral. Ejecutar en Supabase > SQL Editor.
-- El control de rol admin vive en `perfiles.tipo_cuenta`
-- ('standard' | 'admin' | 'suspendido'), ya existente.
-- ============================================================

-- 1. Reportes de proyectos, comentarios o perfiles
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  reportado_por uuid not null,
  tipo text not null check (tipo in ('proyecto', 'comentario', 'perfil')),
  objetivo_id text not null,
  motivo text not null,
  detalle text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'revisado', 'desestimado')),
  creado_el timestamptz not null default now()
);
create index if not exists idx_reportes_estado on public.reportes (estado);

-- 2. Seguimientos entre usuarios
create table if not exists public.seguimientos (
  id uuid primary key default gen_random_uuid(),
  seguidor_id uuid not null,
  seguido_id uuid not null,
  creado_el timestamptz not null default now(),
  unique (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);
create index if not exists idx_seg_seguidor on public.seguimientos (seguidor_id);
create index if not exists idx_seg_seguido on public.seguimientos (seguido_id);

-- 3. Vistas de proyectos (estadísticas del artista)
create table if not exists public.vistas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null,
  usuario_id uuid,
  creado_el timestamptz not null default now()
);
create index if not exists idx_vistas_proyecto on public.vistas (proyecto_id);

-- 4. Retos creativos (los crea el admin)
create table if not exists public.retos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  termina_el date,
  activo boolean not null default true,
  creado_por uuid,
  creado_el timestamptz not null default now()
);

-- 5. Participaciones en retos
create table if not exists public.reto_participaciones (
  id uuid primary key default gen_random_uuid(),
  reto_id uuid not null references public.retos (id) on delete cascade,
  proyecto_id uuid not null,
  usuario_id uuid not null,
  creado_el timestamptz not null default now(),
  unique (reto_id, proyecto_id)
);
create index if not exists idx_part_reto on public.reto_participaciones (reto_id);

-- 6. Perfil laboral (resto de columnas ya existen)
alter table public.perfiles
  add column if not exists disponible_trabajo boolean not null default false;
alter table public.perfiles add column if not exists area_trabajo text;
alter table public.perfiles add column if not exists contacto_trabajo text;

-- 7. RLS permisivo (mismo modelo que el resto de la app)
alter table public.reportes enable row level security;
alter table public.seguimientos enable row level security;
alter table public.vistas enable row level security;
alter table public.retos enable row level security;
alter table public.reto_participaciones enable row level security;

drop policy if exists "acceso total" on public.reportes;
create policy "acceso total" on public.reportes
  for all using (true) with check (true);

drop policy if exists "acceso total" on public.seguimientos;
create policy "acceso total" on public.seguimientos
  for all using (true) with check (true);

drop policy if exists "acceso total" on public.vistas;
create policy "acceso total" on public.vistas
  for all using (true) with check (true);

drop policy if exists "acceso total" on public.retos;
create policy "acceso total" on public.retos
  for all using (true) with check (true);

drop policy if exists "acceso total" on public.reto_participaciones;
create policy "acceso total" on public.reto_participaciones
  for all using (true) with check (true);

-- 8. Primer admin 
-- update public.perfiles set tipo_cuenta = 'admin'
-- where id = (select id from auth.users where email = 'mora.garrido.cd@gmail.com');

-- 9. Moderación admin: permitir al admin borrar cualquier proyecto/comentario.
-- Sin esto, el DELETE desde el panel devuelve 0 filas por RLS (sin error)
-- y el comentario "reaparece" al volver a la publicación. Ejecutar una vez.
-- is_admin() es security definer para evitar recursión de RLS.
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and tipo_cuenta = 'admin');
$$;

drop policy if exists "admin elimina proyectos" on public.proyectos;
create policy "admin elimina proyectos" on public.proyectos
  for delete using (
    auth.uid() = usuario_id
    or public.is_admin()
  );

drop policy if exists "admin elimina comentarios" on public.comentarios;
create policy "admin elimina comentarios" on public.comentarios
  for delete using (
    auth.uid() = usuario_id
    or public.is_admin()
  );

-- 11. Suspensión de cuentas: permitir al admin cambiar tipo_cuenta.
-- Sin esto, el UPDATE de suspender devuelve 0 filas por RLS (sin error),
-- el panel dice "Cuenta suspendida" pero la cuenta sigue entrando.
drop policy if exists "admin actualiza perfiles" on public.perfiles;
create policy "admin actualiza perfiles" on public.perfiles
  for update using (
    auth.uid() = id
    or public.is_admin()
  )
  with check (
    auth.uid() = id
    or public.is_admin()
  );

-- 10. Registro robusto: columna de nacimiento + perfil automático al registrarse.
-- Evita el error "violates foreign key constraint perfiles_id_fkey" cuando
-- el signup aún no tiene sesión (confirmación de correo pendiente): el perfil
-- se crea en el servidor con el id real de auth.users. Ejecutar una vez.
alter table public.perfiles add column if not exists fecha_nacimiento date;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre_completo, biografia, avatar_url, tipo_cuenta, fecha_nacimiento)
  values (
    new.id,
    'Nuevo Artista',
    'Cuenta pendiente de verificación.',
    'https://via.placeholder.com/150',
    coalesce(new.raw_user_meta_data->>'tipo_cuenta', 'estandar'),
    nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
