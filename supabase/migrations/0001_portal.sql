-- Portal do paciente savi.core: tabelas, RLS, bucket e políticas de storage.
-- Paciente: lê só o próprio cadastro/painéis/envios; insere envio só para si
-- (situacao = 'recebido'); nunca altera nem apaga. Escrita de painéis só via
-- service role (script de publicação).

-- ---------------------------------------------------------------- tabelas

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nome text not null,
  email text unique not null,
  nascimento date,
  ativo boolean not null default true,
  criado_em timestamptz default now()
);

create table public.paineis (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes (id),
  publicado_em timestamptz default now(),
  marcadores jsonb not null,
  evolucao jsonb not null,
  paciente jsonb not null,
  zonas jsonb,
  plano jsonb not null
);

create index paineis_paciente_publicado_idx
  on public.paineis (paciente_id, publicado_em desc);

create table public.envios (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes (id),
  arquivos text[] not null,
  observacao text,
  enviado_em timestamptz default now(),
  situacao text not null default 'recebido'
    check (situacao in ('recebido', 'incorporado'))
);

create index envios_paciente_enviado_idx
  on public.envios (paciente_id, enviado_em desc);

-- ------------------------------------------------- paciente da sessão atual

-- id do paciente ativo vinculado a auth.uid(); null se inativo ou sem vínculo.
-- security definer: lê pacientes sem passar pela RLS (evita recursão).
create function public.meu_paciente_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.pacientes p
  where p.user_id = (select auth.uid())
    and p.ativo
$$;

revoke execute on function public.meu_paciente_id() from public, anon;
grant execute on function public.meu_paciente_id() to authenticated, service_role;

-- ---------------------------------------------------------------- grants
-- O Supabase concede ALL a anon/authenticated em tabelas novas do schema
-- public. Reduzimos ao mínimo: RLS continua sendo a barreira principal, os
-- grants são a segunda (update/delete/truncate nunca chegam a ser avaliados).

revoke all on table public.pacientes, public.paineis, public.envios from anon, authenticated;

grant select on table public.pacientes, public.paineis, public.envios to authenticated;
-- enviado_em fica sempre no default do servidor.
grant insert (id, paciente_id, arquivos, observacao, situacao)
  on table public.envios to authenticated;

-- ------------------------------------------------------------------- RLS

alter table public.pacientes enable row level security;
alter table public.paineis enable row level security;
alter table public.envios enable row level security;

create policy "paciente lê o próprio cadastro"
  on public.pacientes for select to authenticated
  using (id = (select public.meu_paciente_id()));

create policy "paciente lê os próprios painéis"
  on public.paineis for select to authenticated
  using (paciente_id = (select public.meu_paciente_id()));

create policy "paciente lê os próprios envios"
  on public.envios for select to authenticated
  using (paciente_id = (select public.meu_paciente_id()));

-- Só para si, sempre 'recebido', com ao menos um arquivo e todos os arquivos
-- em <paciente_id>/<envio_id>/ (impede apontar para arquivos de outro).
create policy "paciente cria envio para si"
  on public.envios for insert to authenticated
  with check (
    paciente_id = (select public.meu_paciente_id())
    and situacao = 'recebido'
    and cardinality(arquivos) > 0
    and not exists (
      select 1
      from unnest(arquivos) as a(caminho)
      where not starts_with(a.caminho, paciente_id::text || '/' || id::text || '/')
    )
  );

-- Nenhuma política de update/delete: pacientes nunca alteram nem apagam.

-- --------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'envios',
  'envios',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "paciente envia arquivo para a própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'envios'
    and (storage.foldername(name))[1] = (select public.meu_paciente_id())::text
  );

create policy "paciente lê arquivo da própria pasta"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'envios'
    and (storage.foldername(name))[1] = (select public.meu_paciente_id())::text
  );

-- Sem update/delete em storage.objects para pacientes (sem sobrescrever,
-- mover ou apagar).
