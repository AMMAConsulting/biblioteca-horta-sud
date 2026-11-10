-- Biblioteca de L'Horta Sud: fuentes aportadas por cualquiera + fragmentos para el chat.

create extension if not exists unaccent with schema extensions;

create or replace function public.sin_acentos(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')) $$;

-- Fuentes (una por documento, enlace o texto aportado)
create table public.fuentes (
  id            uuid primary key default gen_random_uuid(),
  creado        timestamptz not null default now(),
  titulo        text not null check (char_length(titulo) between 3 and 300),
  autor         text check (char_length(autor) <= 300),
  anio          int  check (anio between 1000 and 2100),
  municipio     text not null,
  tema          text check (char_length(tema) <= 100),
  tipo          text not null check (tipo in ('pdf', 'docx', 'txt', 'url', 'texto')),
  url           text check (char_length(url) <= 2000),
  archivo       text,                 -- ruta en el bucket privado «bibliografia»
  aportado_por  text check (char_length(aportado_por) <= 120),
  descripcion   text check (char_length(descripcion) <= 1000),
  n_caracteres  int  not null default 0,
  n_fragmentos  int  not null default 0,
  ip_hash       text,                 -- solo para frenar abusos; no identifica a nadie
  estado        text not null default 'publicada' check (estado in ('publicada', 'oculta'))
);
create index fuentes_creado_idx on public.fuentes (creado desc);
create index fuentes_ip_idx on public.fuentes (ip_hash, creado);

-- Fragmentos de texto en los que busca el chat
create table public.fragmentos (
  id        bigint generated always as identity primary key,
  fuente_id uuid not null references public.fuentes(id) on delete cascade,
  orden     int  not null,
  texto     text not null,
  tsv       tsvector
);
create index fragmentos_tsv_idx on public.fragmentos using gin (tsv);
create index fragmentos_fuente_idx on public.fragmentos (fuente_id);

create or replace function public.fragmentos_tsv() returns trigger
language plpgsql set search_path = '' as $$
declare t text; m text;
begin
  select f.titulo, f.municipio into t, m from public.fuentes f where f.id = new.fuente_id;
  new.tsv := setweight(to_tsvector('spanish', public.sin_acentos(coalesce(t, '') || ' ' || coalesce(m, ''))), 'A')
          || setweight(to_tsvector('spanish', public.sin_acentos(new.texto)), 'B');
  return new;
end $$;
create trigger fragmentos_tsv_trg before insert or update of texto on public.fragmentos
for each row execute function public.fragmentos_tsv();

-- Registro mínimo de consultas (sin el texto de la pregunta) para el límite diario
create table public.consultas (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  creado  timestamptz not null default now()
);
create index consultas_user_idx on public.consultas (user_id, creado);

-- Seguridad: el catálogo es público; fragmentos y consultas solo los toca el servidor
alter table public.fuentes    enable row level security;
alter table public.fragmentos enable row level security;
alter table public.consultas  enable row level security;

create policy "catalogo publico" on public.fuentes
  for select to anon, authenticated using (estado = 'publicada');

revoke all on public.fuentes from anon, authenticated;
grant select (id, creado, titulo, autor, anio, municipio, tema, tipo, url, aportado_por,
              descripcion, n_caracteres, n_fragmentos, estado)
  on public.fuentes to anon, authenticated;
revoke all on public.fragmentos, public.consultas from anon, authenticated;

-- Búsqueda de fragmentos (solo la usa la función «preguntar»)
create or replace function public.buscar_fragmentos(pregunta text, p_municipio text default null, n int default 12)
returns table (fragmento_id bigint, fuente_id uuid, texto text, titulo text, autor text,
               anio int, municipio text, url text, tipo text, rango real)
language plpgsql stable security definer set search_path = ''
as $$
declare q tsquery;
begin
  select string_agg(quote_literal(s.l), ' | ')::tsquery into q
  from (select distinct lexeme as l
        from unnest(to_tsvector('spanish', public.sin_acentos(pregunta)))
        where length(lexeme) > 2
          and lexeme not in ('els','les','amb','per','del','dels','una','que','hi','ha','com',
                             'mes','pel','pels','aquest','aquesta','son','esta','sobr','cual','quin','quina')) s;
  if q is null then return; end if;

  return query
  select fr.id, f.id, fr.texto, f.titulo, f.autor, f.anio, f.municipio, f.url, f.tipo,
         ts_rank_cd(fr.tsv, q)
  from public.fragmentos fr
  join public.fuentes f on f.id = fr.fuente_id
  where f.estado = 'publicada'
    and fr.tsv @@ q
    and (p_municipio is null or f.municipio in (p_municipio, 'Toda la comarca'))
  order by ts_rank_cd(fr.tsv, q) desc
  limit least(greatest(n, 1), 30);
end $$;
revoke all on function public.buscar_fragmentos(text, text, int) from public, anon, authenticated;
grant execute on function public.buscar_fragmentos(text, text, int) to service_role;

-- Bucket privado para los archivos originales (los usuarios solo ven la ficha)
insert into storage.buckets (id, name, public, file_size_limit)
values ('bibliografia', 'bibliografia', false, 15728640)
on conflict (id) do nothing;
