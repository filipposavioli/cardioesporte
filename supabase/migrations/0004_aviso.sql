-- Aviso ao médico: uma vez por envio, observação limitada e grants explícitos (revisão final).

-- 1. Quando o médico foi avisado do envio. Só o servidor (service role) preenche: a coluna fica
--    fora do grant de insert do paciente (0001) e o paciente não tem update. A rota do aviso faz
--    `update ... set avisado_em = now() where id = ? and avisado_em is null` e só manda o e-mail
--    se essa linha mudou, então repetir o POST não gera outro e-mail.
alter table public.envios add column avisado_em timestamptz;

-- 2. Observação com no máximo 1000 caracteres (o app também corta no texto do aviso). Linhas
--    antigas maiores são cortadas antes, para a restrição valer em todo o histórico.
update public.envios set observacao = left(observacao, 1000) where char_length(observacao) > 1000;
alter table public.envios
  add constraint envios_observacao_tamanho
  check (char_length(observacao) <= 1000);

-- 3. Grants explícitos ao service role, sem depender dos privilégios padrão da plataforma.
grant select, insert, update, delete
  on table public.pacientes, public.paineis, public.envios, public.limites_login
  to service_role;
grant usage, select on sequence public.limites_login_id_seq to service_role;
-- A sequência herdou os privilégios padrão (anon/authenticated); eles não precisam dela.
revoke all on sequence public.limites_login_id_seq from anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer, timestamptz) to service_role;
grant execute on function public.meu_paciente_id() to service_role;
