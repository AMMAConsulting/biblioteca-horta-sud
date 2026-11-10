-- Consumo de cada pregunta (solo cifras; nunca el texto) y contador público agregado
alter table public.consultas
  add column tokens_entrada int  not null default 0,
  add column tokens_salida  int  not null default 0,
  add column uso_ia         boolean not null default true,
  add column wh_min real not null default 0, add column wh real not null default 0, add column wh_max real not null default 0,
  add column ml_min real not null default 0, add column ml real not null default 0, add column ml_max real not null default 0;

create or replace function public.estadisticas() returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'preguntas',   (select count(*) from public.consultas),
    'con_ia',      (select count(*) from public.consultas where uso_ia),
    'tokens',      (select coalesce(sum(tokens_entrada + tokens_salida), 0) from public.consultas),
    'wh',          (select json_build_object('min', coalesce(sum(wh_min),0), 'central', coalesce(sum(wh),0), 'max', coalesce(sum(wh_max),0)) from public.consultas),
    'ml',          (select json_build_object('min', coalesce(sum(ml_min),0), 'central', coalesce(sum(ml),0), 'max', coalesce(sum(ml_max),0)) from public.consultas),
    'usuarios',    (select count(*) from auth.users),
    'documentos',  (select count(*) from public.fuentes where estado = 'publicada')
  )
$$;
revoke all on function public.estadisticas() from public;
grant execute on function public.estadisticas() to anon, authenticated;
