-- Limites de login no app (decisão R11). Os limites do Supabase Auth são por IP, e esse IP
-- é o do servidor Next: viram um balde único para todos os pacientes. Aqui o servidor conta
-- tentativas por e-mail e por IP do cliente (chaves já chegam como hash sha256, sem dado em claro).
-- Só o servidor (service role) acessa: RLS ligada e nenhuma política para anon/authenticated.

create table public.limites_login (
  id bigint generated always as identity primary key,
  chave text not null,
  criado_em timestamptz not null default now()
);

create index limites_login_chave_criado_em on public.limites_login (chave, criado_em);

alter table public.limites_login enable row level security;
revoke all on table public.limites_login from anon, authenticated;

-- Consome uma tentativa de `p_chave` se houver vaga na janela; devolve o id da linha
-- (para poder devolver a vaga) ou null se o limite já foi atingido. O advisory lock por
-- chave serializa chamadas simultâneas, então o limite não estoura por corrida.
create function public.consumir_limite(
  p_chave text,
  p_limite integer,
  p_janela_s integer,
  p_agora timestamptz default now()
) returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('limites_login:' || p_chave, 0));

  -- Limpeza oportunista: nada passa de 1 dia (a maior janela é 1 hora).
  delete from public.limites_login
   where chave = p_chave and criado_em < p_agora - interval '1 day';
  if random() < 0.01 then
    delete from public.limites_login where criado_em < p_agora - interval '1 day';
  end if;

  if (select count(*) from public.limites_login
       where chave = p_chave
         and criado_em > p_agora - make_interval(secs => p_janela_s)
         and criado_em <= p_agora) >= p_limite then
    return null;
  end if;

  insert into public.limites_login (chave, criado_em)
  values (p_chave, p_agora)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.consumir_limite(text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer, timestamptz) to service_role;
