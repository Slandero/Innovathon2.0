-- ViveCUU — esquema UNIFICADO (app Next.js + flujo n8n "F1 Incidente (Momento WOW)")
-- Pegar en Supabase → SQL Editor y ejecutar completo. Después: supabase/seed_infra.sql.
-- OJO: borra y recrea las tablas (datos de prueba del hackathon).
--
-- Compatibilidad con el flujo de n8n de Innovathon 2.0:
--   · alertas acepta `meta` (además de `payload`)
--   · overrides_semaforo acepta `semaforo_id` sin `expira` (un trigger lo traduce al osm_id)
--   · incidentes tiene `created_at` además de `inicio`

create extension if not exists postgis;

drop table if exists overrides_semaforo, alertas, emergencias, incidentes, reportes, lecturas_iot, camiones,
  rutas_camion, zonas_escolares, infra, sim_control, estado_ciudad cascade;
drop function if exists semaforo_cercano(double precision, double precision);

-- ───────────────────────── Infraestructura real de OSM
create table if not exists infra (
  id bigserial primary key,
  osm_id bigint,
  tipo text not null check (tipo in ('semaforo','alto','tope','cruce','escuela','hospital','parada')),
  nombre text,
  lat double precision not null,
  lng double precision not null,
  geom geography(Point,4326) generated always as (st_setsrid(st_makepoint(lng,lat),4326)::geography) stored,
  meta jsonb default '{}'
);
create index if not exists infra_geom_idx on infra using gist(geom);
create index if not exists infra_tipo_idx on infra(tipo);
create unique index if not exists infra_osm_tipo_idx on infra(osm_id, tipo);

create table if not exists zonas_escolares (
  id bigserial primary key,
  escuela_id bigint references infra(id) on delete cascade,
  nombre text,
  limite_kmh int default 20,
  horarios text default '07:00-08:30,12:30-14:30',
  poligono jsonb not null            -- GeoJSON Polygon (buffer 150 m)
);

-- ───────────────────────── Camiones
create table if not exists rutas_camion (
  id text primary key,
  nombre text not null,
  color text not null,
  trazo jsonb not null,              -- GeoJSON LineString
  paradas jsonb default '[]'         -- [{nombre, lat, lng, km}]
);

create table if not exists camiones (
  id text primary key,
  ruta_id text references rutas_camion(id) on delete cascade,
  capacidad int default 80,
  ocupacion int default 0,
  proxima_parada text,
  eta_min int,
  fuente text default 'sim' check (fuente in ('sim','iot')),
  lat double precision, lng double precision,
  heading double precision,
  updated_at timestamptz default now()
);

create table if not exists lecturas_iot (
  id bigserial primary key,
  device_id text not null,
  camion_id text references camiones(id) on delete set null,
  suben int default 0,
  bajan int default 0,
  ocupacion int,
  lat double precision, lng double precision,
  ts timestamptz default now()
);

-- ───────────────────────── Reportes ciudadanos
create table if not exists reportes (
  id bigserial primary key,
  tipo text,                          -- bache|tope|semaforo_fallando|obra|accidente|basura|luminaria|fuga_agua|otro
  severidad int check (severidad between 1 and 5),
  titulo text,
  descripcion text,
  resumen_ia text,
  dependencia text,                   -- municipio|transito|jmas|cfe|ninguna
  confianza real,
  foto_url text,
  votos int default 1,
  estado text default 'abierto' check (estado in ('abierto','en_revision','resuelto')),
  lat double precision not null,
  lng double precision not null,
  geom geography(Point,4326) generated always as (st_setsrid(st_makepoint(lng,lat),4326)::geography) stored,
  created_at timestamptz default now()
);
create index if not exists reportes_geom_idx on reportes using gist(geom);

-- ───────────────────────── Incidentes (congestion/peligro/otro agregados para n8n y /demo)
create table if not exists incidentes (
  id bigserial primary key,
  tipo text not null check (tipo in ('accidente','cierre','obra','evento','congestion','peligro','otro')),
  descripcion text,
  calle text,
  carril_bloqueado int[] default '{}',
  carriles_totales int default 3,
  severidad int default 3,
  retraso_min int,
  votos int default 1,
  origen text,
  estado text default 'activo' check (estado in ('activo','resuelto')),
  inicio timestamptz default now(),
  created_at timestamptz default now(),
  fin timestamptz,
  lat double precision not null,
  lng double precision not null,
  edge_ref text
);

create table if not exists emergencias (
  id bigserial primary key,
  tipo text default 'ambulancia',
  estado text default 'solicitada' check (estado in ('solicitada','en_camino','en_sitio','cancelada')),
  hospital_id bigint references infra(id),
  hospital_nombre text,
  lat double precision not null,
  lng double precision not null,
  ruta jsonb,                         -- GeoJSON LineString
  amb_lat double precision,
  amb_lng double precision,
  eta_seg int,
  semaforos_verdes int default 0,
  created_at timestamptz default now()
);

-- ───────────────────────── n8n: bitácora de lo que hizo la automatización
create table if not exists alertas (
  id bigserial primary key,
  tipo text check (tipo in ('911_simulado','familiar','desvio','dependencia','resumen','zona_escolar')),
  titulo text,
  mensaje text,
  payload jsonb,
  meta jsonb default '{}'::jsonb,          -- nombre que usa el flujo de n8n
  incidente_id bigint references incidentes(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists overrides_semaforo (
  osm_id bigint primary key,
  semaforo_id bigint,                      -- id de infra (formato del flujo de n8n)
  lat double precision,                    -- opcional: el trigger elige el semáforo más cercano
  lng double precision,
  estado text check (estado in ('verde','rojo')),
  motivo text,
  expira timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz default now()
);

-- n8n puede mandar {lat, lng, estado, motivo} o {semaforo_id, ...}: se traduce al osm_id del semáforo
-- real más cercano y se reemplaza el override previo de ese semáforo (sin choques de llave)
create or replace function overrides_compat() returns trigger language plpgsql as $$
begin
  if new.osm_id is null and new.lat is not null and new.lng is not null then
    select osm_id into new.osm_id from infra where tipo = 'semaforo'
      order by geom <-> st_setsrid(st_makepoint(new.lng,new.lat),4326)::geography limit 1;
  end if;
  if new.osm_id is null then
    select osm_id into new.osm_id from infra where id = new.semaforo_id and tipo = 'semaforo';
  end if;
  if new.osm_id is null then
    select osm_id into new.osm_id from infra where tipo = 'semaforo' order by id limit 1;
  end if;
  if new.estado = 'amarillo' then new.estado := 'rojo'; end if;
  delete from overrides_semaforo where osm_id = new.osm_id;
  return new;
end $$;
create trigger overrides_compat before insert on overrides_semaforo
  for each row execute function overrides_compat();

-- ───────────────────────── Control del motor desde /demo
create table if not exists sim_control (
  id int primary key default 1 check (id = 1),
  hora_pico boolean default false,
  velocidad int default 1,
  forzar_zonas boolean default false,
  congelar jsonb,                    -- {lat, lng, radio_m, hasta}: "congestión total en punto"
  updated_at timestamptz default now()
);
insert into sim_control (id) values (1) on conflict do nothing;

-- ───────────────────────── Estado agregado que publica el motor (para /api/ciudad/estado y el asistente)
create table if not exists estado_ciudad (
  id int primary key default 1 check (id = 1),
  corredores jsonb default '[]',     -- [{nombre, nivel, vel_kmh, pronostico_30min, nivel_30min, incidentes}]
  n_vehiculos int default 0,
  demanda real,
  updated_at timestamptz default now()
);

-- ───────────────────────── Funciones
-- Deduplicación: reportes del mismo tipo a <30 m en 48 h
create or replace function reportes_cercanos(p_lat double precision, p_lng double precision, p_tipo text)
returns setof reportes language sql stable as $$
  select * from reportes
  where tipo = p_tipo and estado <> 'resuelto'
    and created_at > now() - interval '48 hours'
    and st_dwithin(geom, st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography, 30)
  order by created_at desc limit 1;
$$;

create or replace function votar_reporte(p_id bigint)
returns void language sql security definer as $$
  update reportes set votos = votos + 1 where id = p_id;
$$;

create or replace function semaforo_cercano(lat double precision, lng double precision)
returns table (id bigint, osm_id bigint, nombre text, distancia_m double precision)
language sql stable as $$
  select i.id, i.osm_id, i.nombre, st_distance(i.geom, st_setsrid(st_makepoint(lng,lat),4326)::geography)
  from infra i where i.tipo = 'semaforo'
  order by i.geom <-> st_setsrid(st_makepoint(lng,lat),4326)::geography
  limit 1;
$$;

create or replace function hospital_cercano(lat double precision, lng double precision)
returns table (id bigint, nombre text, h_lat double precision, h_lng double precision, distancia_m double precision)
language sql stable as $$
  select i.id, i.nombre, i.lat, i.lng, st_distance(i.geom, st_setsrid(st_makepoint(lng,lat),4326)::geography)
  from infra i where i.tipo = 'hospital'
  order by i.geom <-> st_setsrid(st_makepoint(lng,lat),4326)::geography
  limit 1;
$$;

-- ───────────────────────── Realtime
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['reportes','incidentes','emergencias','camiones','alertas','overrides_semaforo','sim_control','rutas_camion'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ───────────────────────── RLS: lectura pública; escritura ciudadana solo en emergencias
alter table infra enable row level security;
alter table zonas_escolares enable row level security;
alter table rutas_camion enable row level security;
alter table camiones enable row level security;
alter table reportes enable row level security;
alter table incidentes enable row level security;
alter table emergencias enable row level security;
alter table lecturas_iot enable row level security;
alter table alertas enable row level security;
alter table overrides_semaforo enable row level security;
alter table sim_control enable row level security;
alter table estado_ciudad enable row level security;
create policy "lectura" on infra for select using (true);
create policy "lectura" on zonas_escolares for select using (true);
create policy "lectura" on rutas_camion for select using (true);
create policy "lectura" on camiones for select using (true);
create policy "lectura" on reportes for select using (true);
create policy "lectura" on incidentes for select using (true);
create policy "lectura" on emergencias for select using (true);
create policy "lectura" on alertas for select using (true);
create policy "lectura" on overrides_semaforo for select using (true);
create policy "lectura" on sim_control for select using (true);
create policy "lectura" on estado_ciudad for select using (true);
create policy "insertar" on emergencias for insert with check (true);
-- Reportes, incidentes y votos se escriben desde API routes con service role.

-- ───────────────────────── Storage: bucket público de fotos de reportes
insert into storage.buckets (id, name, public) values ('reportes', 'reportes', true)
on conflict (id) do nothing;
